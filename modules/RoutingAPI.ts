/**
 * Making use of Nominatim Open Street Maps to get the longitude and
 * latitude of a location, and then generating the route to all the
 * nearest institutions from this property.
*/
const fetch = require('node-fetch');
import {Property, PropertyModel} from '../GQL/entities/Property'
import {Institution, InstitutionModel} from '../GQL/entities/Institution'
import {DocumentType} from '@typegoose/typegoose'
import {getDistance} from 'geolib'

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
    static generateRoutes (property: Property) {

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

                nearby_institutions.forEach((institute: DocumentType<Institution>) => {
                    // From the nearby institutions, generate all the necessary routes
                    // from this property to the institution
                    let institute_location: LongLat = {
                        longitude: institute.location.longitude,
                        latitude: institute.location.latitude
                    }

                    // Foot Walking
                    this.requestRoute(location_data, institute_location, 'foot-walking')
                    .then((route_response: any) => {
                        console.log(`Route: `, route_response)
                    });

                    // Driving Car
                    this.requestRoute(location_data, institute_location, 'driving-car')
                    .then((route_response: any) => {
                        console.log(`Route: `, route_response)
                    });

                    // Cycling Regular
                    this.requestRoute(location_data, institute_location, 'cycling-regular')
                    .then((route_response: any) => {
                        console.log(`Route: `, route_response)
                    });

                })

            })

        })
        .catch((err: any) => {
            console.error(`Error fetching longitude & latiude for property with _id: ${property._id}`);
        })

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