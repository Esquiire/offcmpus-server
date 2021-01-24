/**
 * Making use of Nominatim Open Street Maps to get the longitude and
 * latitude of a location, and then generating the route to all the
 * nearest institutions from this property.
*/
const fetch = require('node-fetch');
import {Property, PropertyModel, DirectionCoordinates, PropertyDirections} from '../GQL/entities/Property'
import {Institution, InstitutionModel} from '../GQL/entities/Institution'
import {DocumentType} from '@typegoose/typegoose'
import {getDistance} from 'geolib'
const util = require('util')

import express from 'express'
const routingRouter = express.Router();

routingRouter.get(`/test`, async (req, res) => {

    let properties: DocumentType<Property>[] = await PropertyModel.find() as DocumentType<Property>[]
    let property: DocumentType<Property> = properties[1];

    RoutingAPI.generateRoutes(property);

})

interface LongLat {
    longitude: number
    latitude: number
}

export default routingRouter;

export class RoutingAPI {

    /**
     * Find the institutions that are nearby to this property
     * and find the walking, cycling and driving routes from this
     * property to those institutions.
     */
    static generateRoutes (property: DocumentType<Property>) {

        // Get the longitude and latitude of the property 
        // https://nominatim.openstreetmap.org/search?q=135+pilkington+avenue,+birmingham&format=json&polygon=1&addressdetails=1
        let addr_str: string = `${property.address_line} ${property.address_line_2  == null || property.address_line_2 == "" ? "" : `${property.address_line_2}, `}`;
        addr_str += `${property.city} ${property.state}, ${property.zip}`;

        // replace spaces with pluses.
        addr_str = addr_str.split(' ').join('+');

        fetch(`https://nominatim.openstreetmap.org/search?q=${addr_str}&format=json&polygon=1&addressdetails=1`, {
            method: 'GET',
        })
        .then((res: any) => res.json())
        .then((data: any) => {
            if (data == null || data.length == 0) {
                console.error(`No longitude and latitude data could be found for property with _idL ${property._id}`);
                return;
            }
            let response_data = data[0];

            let location_data: LongLat = {
                longitude: response_data.lon,
                latitude: response_data.lat
            };

            console.log(`Location data: `, location_data);

            this.findInstituionsNear(location_data)
            .then((nearby_institutions: DocumentType<Institution>[]) => {

                let all_directions_promises: Promise<PropertyDirections>[] = [];
                nearby_institutions.forEach((institute: DocumentType<Institution>) => {
                    // From the nearby institutions, generate all the necessary routes
                    // from this property to the institution
                    
                    all_directions_promises.push(new Promise((resolve, reject) => {

                        let institute_location: LongLat = {
                            longitude: institute.location.longitude,
                            latitude: institute.location.latitude
                        }
    
                        let coord_promises: Promise<DirectionCoordinates[]>[] = [
                            this.fetchDirectionCoords(location_data, institute_location, 'foot-walking'),
                            this.fetchDirectionCoords(location_data, institute_location, 'driving-car'),
                            this.fetchDirectionCoords(location_data, institute_location, 'cycling-regular')
                        ];
    
                        Promise.all(coord_promises)
                        .then((promise_result: DirectionCoordinates[][]) => {
                            
                            // create the property directions object
                            let property_directions: PropertyDirections = new PropertyDirections();
                            property_directions.institution_id = institute._id;
    
                            // foot waling directions ...
                            if (promise_result[0].length != 0)
                                property_directions.foot_walking_directions = promise_result[0];
                                
                            // driving car directions ...
                            if (promise_result[1].length != 0)
                                property_directions.driving_car_directions = promise_result[1];
    
                            // cycling directions ...
                            if (promise_result[2].length != 0)
                                property_directions.cycling_regular_directions = promise_result[2];
    
                                resolve(property_directions);
                        })

                    })); // end all_directions_promises.push()
                }) // end nearby_institutions.foeEach()

                // wait for all of the promises to resolve
                Promise.all(all_directions_promises)
                .then(async (all_directions: PropertyDirections[]) => {

                    // save the directions information to the property
                    console.log(`Saving property with directions! ...`);
                    property.directions = all_directions;
                    let saved_prop = await property.save() as DocumentType<Property>;

                    // print saved property data
                    console.log(saved_prop);

                })

            })

        })
        .catch((err: any) => {
            console.error(`Error fetching longitude & latiude for property with _id: ${property._id}`);
        })

    }
    
    /**
     * @desc Given the start and end position for directions, and the mode of transportaiton (type),
     * return an array of all the coordinate information returned by the routing api.
     * @param start the start position longitude & latitude
     * @param end the end position longitude & latitude
     * @param type the type of direction to get
     */
    static async fetchDirectionCoords 
        (start: LongLat, end: LongLat, type: 'foot-walking' | 'driving-car' | 'cycling-regular'): Promise<DirectionCoordinates[]> {

            return new Promise((resolve, reject) => {
                let dirs: DirectionCoordinates[] = [];

                this.requestRoute(start, end, type)
                .then((route_response: any) => {

                    // if we recieved coordinate data from the API, create DirectionCoordinates for them
                    if (route_response && route_response.features && route_response.features.length != 0) {
                        

                        // console.log(util.inspect(route_response, false, null, true));

                        route_response.features.filter((route_: any) => 

                            // filter for the route geometry for the coordinates
                            Object.prototype.hasOwnProperty.call(route_, `geometry`) 
                            && Object.prototype.hasOwnProperty.call(route_.geometry, `coordinates`)

                            // filter for route segment to get distance
                            && Object.prototype.hasOwnProperty.call(route_, `properties`) 
                            && Object.prototype.hasOwnProperty.call(route_.properties, `segments`)
                            && route_.properties.segments.length > 0
                        ).forEach((route_: any) => {

                            // create a direction coordinates object for the route
                            let dir_info: DirectionCoordinates = new DirectionCoordinates();
                            dir_info.coordinates = route_.geometry.coordinates;
                            dir_info.distance = route_.properties.segments[0].distance;

                            // add this route to our array of direction routes
                            dirs.push(dir_info);
                        });
                            
                    }
                    resolve(dirs);
                });
            });
    }

    static async findInstituionsNear (location: LongLat): Promise<DocumentType<Institution>[]> {
        
        // fetch all the institutions
        let institutions: DocumentType<Institution>[] = await InstitutionModel.find() as DocumentType<Institution>[];

        // find all the properties that are within 50 miles from the property
        let MAX_DIST = 50 /* miles */ * 1609.34 /* miles to meters */;
        institutions = institutions.filter((institution: DocumentType<Institution>) => getDistance(
                { longitude: location.longitude, latitude: location.latitude }, 
                { longitude: institution.location.longitude, latitude: institution.location.latitude }
        ) <= MAX_DIST );

        return institutions;
    }

    /**
     * Request the route from locationA to locationB, based on the routing type provided
     * @param locationA The start of the routing request
     * @param locationB The end of the routing request
     * @param routeType The type of route to fetch
     */
    static async requestRoute (
        locationA: LongLat, 
        locationB: LongLat, 
        routeType: 'foot-walking' | 'driving-car' | 'cycling-regular') {

            return fetch(`https://api.openrouteservice.org/v2/directions/${routeType}?api_key=${process.env.OPEN_ROUTE_SERVICE_API_KEY}&start=${locationA.longitude},${locationA.latitude}&end=${locationB.longitude},${locationB.latitude}`,
            {method: 'GET'})
            .then((res: any) => res.json())

    }
}