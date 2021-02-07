import {Resolver, Mutation, Arg, Query, Int} from 'type-graphql'
import {Property, 
  PropertyAPIResponse, 
  PropertyModel, 
  PropertyReviewInput,
  PropertySearchInput,
  PropertyList,
  AddressVerificationAPIResponse,
  PropertyListAPIResponse,
  PropertyImageInfo,
  PropertyDetails} from '../entities/Property'
import {Lease, LeaseModel, createEmptyLease} from '../entities/Lease'
import {Landlord, LandlordModel} from '../entities/Landlord'
import {Ownership, OwnershipModel, StatusType} from '../entities/Ownership'
import {PropertySummary, PropertySummaryAPIResponse} from '../entities/auxillery/PropertySummary'

import {DocumentType} from "@typegoose/typegoose"
import mongoose, {DocumentQuery} from 'mongoose'
import chalk from 'chalk'
const ObjectId = mongoose.Types.ObjectId

// setup usps webtools api
let usps: null | any = null
if (process.env.USPS_USER_ID as string) {
  let USPS = require('usps-webtools')
  usps = new USPS({
    server: 'http://production.shippingapis.com/ShippingAPI.dll',
    userId: (process.env.USPS_USER_ID as string),
    ttl: 10000 //TTL in milliseconds for request
  });
}


@Resolver()
export class PropertyResolver {

  /**
   * getLandlord (_id: mongoose.Types.ObjectId, withReviews: boolean, withLandlord: boolean)
   * @desc This function returns the property with the specified id. If withReviews is true, it will
   *        return the review documents for the property. If withLandlord is true, it will
   *        also return the landlord that owns this property.
   * 
   * @param _id The id for the property to retrieve
   * @param reviewOptions
   *          withReviews: boolean => if true, the reviews of the property will be returned too
   *          offset: number => The offset to return the reviews by
   *          count: number => The amount of reviews to return
   * @param withLandlord 
   */
  @Query(() => PropertyAPIResponse)
  async getProperty(
    @Arg("_id") _id: string, 
    @Arg("reviewOptions") {withReviews, offset, count}: PropertyReviewInput,
    @Arg("withLandlord") withLandlord: boolean): Promise<PropertyAPIResponse>
  {
    console.log(chalk.bgBlue(`👉 getLandlord(id)`))

    let property_: DocumentType<Property> | null = await PropertyModel.findById(_id)
    if (property_ == null) {
      console.log(chalk.bgRed(`❌ Error: No property exists with id ${_id}`))
      return { success: false, error: "No property found" }
    }

    // check for reviews
    if (withReviews) {
      // TODO fetch the reviews
    }

    let landlord_doc: DocumentType<Landlord> | null = null
    if (withLandlord) {
      landlord_doc = await LandlordModel.findById(property_.landlord)
      if (landlord_doc == null) {
        console.log(chalk.bgRed(`❌ Error: No landlord found with id ${property_.landlord}`))
        return {success: false, error: "No landlord found for this property"}
      }
    }

    // return the landlord
    // console.log(property_.toObject())
    console.log(property_.toObject())
    return {success: true, data: {
      ...property_.toObject(),
      landlord_doc: landlord_doc == null ? undefined : landlord_doc as Landlord
    }}

  }

  @Query(() => PropertyAPIResponse)
  async getPropertyOwnedByLandlord(
    @Arg("property_id") property_id: string,
    @Arg("landlord_id") landlord_id: string,
    @Arg("with_leases", {nullable: true}) with_leases?: boolean
  ): Promise<PropertyAPIResponse>
  {

    console.log(chalk.bgBlue(`👉 getPropertyOwnedByLandlord`))
    if (!ObjectId.isValid(property_id) || !ObjectId.isValid(landlord_id)) {
      console.log(chalk.bgRed(`❌ Error: Invalid object ids provided`))
      return {
        success: false,
        error: `Invalid ids provided`
      }
    }

    let ownership_: DocumentType<Ownership> = await OwnershipModel.findOne({
      property_id,
      landlord_id
    }) as DocumentType<Ownership>

    if (!ownership_) {
      console.log(chalk.bgRed(`❌ Error: Ownership does not exist for landlord ${landlord_id} and property ${property_id}`))
      return {
        success: false,
        error: `No access`
      }
    }
    
    let property_: DocumentType<Property> = await PropertyModel.findById(property_id) as DocumentType<Property>
    if (!property_) {
      console.log(chalk.bgRed(`❌ Error: Property does not exist`))
      return {
        success: false,
        error: `No property found`
      }
    }

    // get the leases for this proeprty
    if (with_leases == true) {

      let leases: DocumentType<Lease>[] = await LeaseModel.find({
        ownership_id: ownership_._id
      }) as DocumentType<Lease>[];

      property_.leases = leases;

    }


    console.log(chalk.bgGreen(`✔ Successfully retrieved property ${property_id} owned by ${landlord_id}`))
    return {
      success: true,
      data: property_
    }

  }

  @Query(() => PropertyListAPIResponse)
  async searchProperties(
    @Arg("searchOptions") {offset, count}:PropertySearchInput
  ): Promise<PropertyListAPIResponse>
  {

    let properties_ = await PropertyModel.find().skip(offset).limit(count).exec()
    return {
      success: true,
      data: {
        properties: properties_
      }
    }

  }

  @Query(() => PropertyListAPIResponse)
  async searchForProperties(
    @Arg("price_start") price_start: number,
    @Arg("price_end") price_end: number,
    @Arg("rooms", type => Int) rooms: number,
    @Arg("distance") distance: number
  ): Promise<PropertyListAPIResponse> 
  {

    // TODO change placeholder query with actual search implementation
    let all_active_leases: DocumentType<Lease>[] = await LeaseModel.find({
      /**
       * Find all of the leases such that they are:
       * 1. on the market (active == true)
       * 2. not currently occupied by anyone (occupant_id == undefined)
       * 3. not externally opccupied (external_occupant == false)
       */
      
      active: true,
      occupant_id: { $exists: false },
      external_occupant: false
    }) as DocumentType<Lease>[];

    // find all of the properties that are associated with
    // the lease.
    type LeaseOwnershipData = {
      ownership_promise: Promise<Ownership | undefined>,
      leases: Lease[]
    };
    let ownerships: {[key: string]: LeaseOwnershipData} = {};
    
    all_active_leases.forEach((lease: DocumentType<Lease>) => {
      if (!Object.prototype.hasOwnProperty.call(ownerships, lease.ownership_id)) {

        let prom: Promise<Ownership | undefined> = new Promise((resolve, reject) => {
          // find the ownership document for each of the leases that match.
          OwnershipModel.findById(lease.ownership_id, 
            (err: any, ownership_doc: DocumentType<Ownership> | null) => {
              if (err || ownership_doc == null) resolve(undefined);
              else resolve(ownership_doc);
          });
        });

        let ownership_data: LeaseOwnershipData = {
          ownership_promise: prom,
          leases: [lease]
        };

        ownerships[lease.ownership_id] = ownership_data;
      }
      // add the lease into the correct array
      else {
        ownerships[lease.ownership_id].leases.push(lease);
      }

    });

    type LeasePropertyData = {
      property_promise: Promise<Property | undefined>,
      leases: Lease[]
    };
    // resolve all the ownership queries and find their properties
    let ownership_keys = Object.keys(ownerships);
    let properties: {[key: string]: LeasePropertyData} = {};

    for (let i = 0; i < ownership_keys.length; ++i) {

      let ownership_data: LeaseOwnershipData = ownerships[ownership_keys[i]];
      let ownership_: Ownership | undefined = await ownership_data.ownership_promise;

      if (ownership_ != undefined 
        && !Object.prototype.hasOwnProperty.call(properties, ownership_.property_id)) {
          
          // now with the ownership document, query for the property document
          // and pass on the lease information to the property
          let prop_id: string = ownership_.property_id;
          let prom: Promise<Property | undefined> = new Promise((resolve, reject) => {
            PropertyModel.findById(prop_id, (err: any, property: DocumentType<Property> | null) => {

              if (err || property == null) resolve (undefined);
              else resolve(property);
            });
          });

          let property_lease_data: LeasePropertyData = {
            property_promise: prom,
            leases: ownership_data.leases
          };

           properties[ownership_.property_id] = property_lease_data;
      }

    }

    // finally, resolve all the properties queried and attach their leases
    // to their respective objects.

    let properties_keys = Object.keys(properties);
    let all_properties: Property[] = [];

    for (let i = 0; i < properties_keys.length; ++i) {

      let property_data: LeasePropertyData = properties[properties_keys[i]];
      let property_: Property | undefined = await property_data.property_promise;

      if (property_ != undefined) {
        property_.leases = property_data.leases;
        all_properties.push(property_);
      }
    }

    return {
      success: true,
      data: {
        properties: all_properties
      }
    }
  }

  /**
   * getPropertiesForLandlord()
   * @decs Get the list of properties that this landlord owns that
   * have there ownerships confirmed
   * 
   * @param landlord_id: string => The id of the landlord to get the properties of 
   */
  @Query(() => PropertyListAPIResponse)
  async getPropertiesForLandlord(
    @Arg("landlord_id") landlord_id: string,
    @Arg("with_leases", type => Boolean, {nullable: true}) with_leases?: boolean,
    @Arg("status", type => String, {nullable: true}) status?: StatusType
  ): Promise<PropertyListAPIResponse> {

    console.log(chalk.bgBlue(`👉 getPropertiesForLandlord()`))
    if (!ObjectId.isValid(landlord_id)) {
      console.log(chalk.bgRed(`❌ Error: landlord_id (${landlord_id}) is not a valid objec tid.`))
      return {
        success: false, error: `Invalid landlord_id`
      }
    }

    let ownerships: DocumentType<Ownership>[] = await OwnershipModel.find({landlord_id}) as DocumentType<Ownership>[]
    let property_leases: {[key: string]: DocumentQuery<DocumentType<Lease>[], DocumentType<Lease>, {}>} = {};
    let _properties: Promise<DocumentType<Property> | null>[] = ownerships
      .filter((ownership: DocumentType<Ownership>) => status != null ? ownership.status == status : ownership.status == 'confirmed')
      .map(async (ownership: DocumentType<Ownership>) => {

        // for each property, if we are querying leases too, add the lease query to the
        // property_leases object.
        if (with_leases) {
          property_leases[ownership.property_id] = LeaseModel.find({
            ownership_id: ownership._id
          });
        }

        return PropertyModel.findById(ownership.property_id);
      })

    let properties = []
    for (let i = 0; i < _properties.length; ++i) {

      let prop: DocumentType<Property> | null = await _properties[i];
      if (prop != null) {
        // wait for the leases to finish resolving
        if (with_leases && Object.prototype.hasOwnProperty.call(property_leases, prop._id)) {
          let leases: DocumentType<Lease>[] = (await property_leases[prop._id]).filter((lease_: DocumentType<Lease>) => lease_ != null);
          prop.leases = leases;
        }

        properties.push(prop);
      }
    }

    return {
      success: true,
      data: { properties }
    }
  }

  @Query(() => AddressVerificationAPIResponse)
  async verifyAddress(
    @Arg("address_1") address_1: string,
    @Arg("address_2") address_2: string,
    @Arg("city") city: string,
    @Arg("state") state: string,
    @Arg("zip") zip: string
  ): Promise<AddressVerificationAPIResponse>
  {

    return new Promise((resolve, reject) => {
      usps.verify({
        street1: address_1,
        street2: address_2,
        city: city,
        state: state,
        zip: zip
      }, function(err: any, address: any) {
        // console.log(err, address);
        if (err) {
          resolve({
            success: false,
            error: "Invalid address"
          })
        }
        else resolve({
          success: true,
          data: {
            address_1: address.street1,
            address_2: address.street2,
            city: address.city,
            state: address.state,
            zip: address.zip
          }
        })
      });
    })

  }

  @Query(() => PropertySummaryAPIResponse)
  async getPropertySummary(
    @Arg("property_id") property_id: string
  ): Promise<PropertySummaryAPIResponse>
  {

    if (!ObjectId.isValid(property_id)) {
      return { success: false, error: "property does not exist." }
    }

    let summary: PropertySummary = new PropertySummary();

    // get the property information
    let property_: DocumentType<Property> = await PropertyModel.findById(property_id) as DocumentType<Property>
    if (property_ == undefined) {
      return { success: false, error: "Property could not be found." }
    }

    // get the ownership information
    let ownerships_: DocumentType<Ownership>[] = 
      await OwnershipModel.find({property_id, status: 'confirmed'}) as DocumentType<Ownership>[];
    
    if (ownerships_ == undefined || ownerships_.length != 1) {
      return { success: false, error: "Could not resolve the owner of this property" }
    }

    // get the landlord information
    let landlord_: DocumentType<Landlord> = await LandlordModel.findById(ownerships_[0].landlord_id) as DocumentType<Landlord>
    if (landlord_ == undefined) {
      return { success: false, error: "No landlord found for this property's ownership" }
    }

    // get the lease information
    let leases_: DocumentType<Lease>[] = await LeaseModel.find({ownership_id: ownerships_[0]._id}) as DocumentType<Lease>[]

    // attach to the summary
    summary.property = property_;
    summary.landlord = landlord_;
    summary.leases = leases_.filter((lease_: Lease) => lease_.active == true);
    
    return {
      success: true,
      data: summary
    }
  }

  @Mutation(() => PropertyAPIResponse)
  async updatePropertyDetails(
    @Arg("property_id", type => String, {nullable: false}) property_id: string,
    @Arg("description", type => String, {nullable: true}) description?: string,
    @Arg("rooms", type => Int, {nullable: true}) rooms?: number,
    @Arg("bathrooms", type => Int, {nullable: true}) bathrooms?: number,
    @Arg("sq_ft", type => Int, {nullable: true}) sq_ft?: number,
    @Arg("furnished", type => Boolean, {nullable: true}) furnished?: boolean,
    @Arg("has_washer", type => Boolean, {nullable: true}) has_washer?: boolean,
    @Arg("has_heater", type => Boolean, {nullable: true}) has_heater?: boolean,
    @Arg("has_ac", type => Boolean, {nullable: true}) has_ac?: boolean
  ): Promise<PropertyAPIResponse> 
  {

    console.log(chalk.bgBlue(`👉 updatePropertyDetails()`))
    if (!ObjectId.isValid(property_id)) {
      console.log(chalk.bgRed(`❌ Error: Property id is not a valid object id`))
      return { success: false, error: `property_id is not valid` }
    }
    let property: DocumentType<Property> = await PropertyModel.findById(property_id) as DocumentType<Property>
    if (!property) {
      console.log(chalk.bgRed(`❌ Error: No property found with id ${property_id}`))
      return { success: false, error: `No property found` }
    }

    let ownerships: DocumentType<Ownership>[] = 
      await OwnershipModel.find({property_id, status: "confirmed"}) as DocumentType<Ownership>[];

    if (ownerships.length != 1) {
      console.error(`Attempting to modify details of a property that has ${ownerships.length} confirmed ownership documents.
      Only 1 confirmed ownership document should exist for each property.`);
      console.log(`\tproperty id: ${property_id}`);
      ownerships.forEach((ownership_: DocumentType<Ownership>, i: number) =>
        console.log(`\townership id (doc ${i + 1}): ${ownership_._id}`));
      return { success: false, error: `Inconsistent records` };
    }
    
    // initialize details if the property doesn't have details
    if (!property.details) property.details = new PropertyDetails();
    
    // add the details provided
    if (description) property.details.description = description;
    if (rooms) {
      // we will create a lease for each room that is specified.
      // The room count of the property can only be modified if there is a matching
      // ownerhip document for this property.
      if (ownerships[0]) {
        let leases_: DocumentType<Lease>[] = await LeaseModel.find({ownership_id: ownerships[0]._id}) as DocumentType<Lease>[];

        let leases_to_make = rooms - leases_.length;
        for (let i = 0; i < leases_to_make; ++i) {
          let new_lease: DocumentType<Lease> = await createEmptyLease({for_ownership_id: ownerships[0]._id});
        }

        // Restrict the reducing of the number of rooms...
        // If the number of rooms needs to be reduced, there needs to be deletion of
        // lease documents that correspond with the rooms being removed, so that should
        // be done in its own dedicated mutation.
        property.details.rooms = Math.max(rooms, leases_.length);
      }
    }
    if (bathrooms) property.details.bathrooms = bathrooms;
    if (sq_ft) property.details.sq_ft = sq_ft;
    if (furnished != null && furnished != undefined) property.details.furnished = furnished;
    if (has_washer != null && has_washer != undefined) property.details.has_washer = has_washer;
    if (has_heater != null && has_heater != undefined) property.details.has_heater = has_heater;
    if (has_ac != null && has_ac != undefined) property.details.has_ac = has_ac;

    let updated_property: DocumentType<Property> = await property.save () as DocumentType<Property>

    console.log(chalk.bgGreen(`✔ Successfully updated details for property (${property_id})`))
    return {
      success: true,
      data: updated_property
    }

  }

  @Mutation(() => PropertyAPIResponse)
  async addImagesToProperty(
    @Arg("property_id") property_id: string,
    @Arg("s3_keys", type => [String]) s3_keys: string[]
  ): Promise<PropertyAPIResponse> {

    console.log(chalk.bgBlue(`👉 addImagesToProperty()`))

    if (s3_keys.length == 0) {
      console.log(chalk.bgRed(`❌ Error: No images to add.`))
      return { success: false, error: `No data to add` }
    }

    if (!ObjectId.isValid(property_id)) {
      console.log(chalk.bgRed(`❌ Error: Property id ${property_id} is not a valid object id`))
      return { success: false, error: `Invalid object id`}
    }

    let property_: DocumentType<Property> = await PropertyModel.findById(property_id) as DocumentType<Property>
    if (!property_) {
      console.log(chalk.bgRed(`❌ Error: Property with id ${property_id} does not exist`))
      return { success: false, error: `Property not found`}
    }

    if (!property_.details) property_.details = new PropertyDetails()
    for (let i = 0; i < s3_keys.length; ++i) {
      let prop_image_info: PropertyImageInfo = {
        s3_key: s3_keys[i],
        date_uploaded: new Date().toISOString()
      }
      
      property_.details.property_images.push(prop_image_info)
    }

    // save property
    let saved_property: DocumentType<Property> = await property_.save() as DocumentType<Property>
    console.log(chalk.green(`✔ Successfully added ${s3_keys.length} images to property ${property_id}`))
    return {
      success: true,
      data: saved_property
    }
  }

  @Mutation(() => PropertyAPIResponse)
  async removeImageFromProperty(
    @Arg("property_id") property_id: string,
    @Arg("s3_key") s3_key: string
  ): Promise<PropertyAPIResponse>
  {
    console.log(chalk.bgBlue(`👉 removeImageFromProperty()`))

    if (!ObjectId.isValid(property_id)) {
      console.log(chalk.bgRed(`❌ Error: property_id ${property_id} is not a valid object id`))
      return {
        success: false,
        error: `Invalid property id provided`
      }
    }

    let property_: DocumentType<Property> = await PropertyModel.findById(property_id) as DocumentType<Property>
    if (!property_ ) {
      console.log(chalk.bgRed(`❌ Error: No property found`))
      return {
        success: false,
        error: `Property does not exist`
      }
    }

    if (property_.details) {
      property_.details.property_images = property_.details.property_images.filter((image_info:PropertyImageInfo) => {
        return image_info.s3_key != s3_key
      })

      let saved_property: DocumentType<Property> = await property_.save() as DocumentType<Property>
      console.log(chalk.bgGreen(`✔ Successfully removed ${s3_key} from property ${property_id}`))
      return {success: true, data: saved_property}
    }

    console.log(chalk.bgYellow(`Property ${property_id} does not have image ${s3_key} in its details`))
    return {success: true, data: property_}
  }
}