import {Resolver, Mutation, Arg, Query, Int} from 'type-graphql'
import {Property, 
  PropertyAPIResponse, 
  PropertyModel, 
  PropertyReviewInput,
  PropertySearchInput,
  PropertyList,
  PropertySearchResultAPIResult,
  PropertySearchResultCollectionAPIResult,
  PropertySearchResult,
  AddressVerificationAPIResponse,
  PropertyListAPIResponse,
  PropertyImageInfo,
  PropertyDetails} from '../entities/Property'
import {Student, StudentModel} from '../entities/Student'
import {Lease, LeaseModel, createEmptyLease} from '../entities/Lease'
import {Landlord, LandlordModel} from '../entities/Landlord'
import {Ownership, OwnershipModel, StatusType} from '../entities/Ownership'
import {PropertySummary, PropertySummaryAPIResponse} from '../entities/auxillery/PropertySummary'

import {DocumentType} from "@typegoose/typegoose"
import mongoose, {DocumentQuery} from 'mongoose'
import chalk from 'chalk'

const util = require('util')
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

  /**
   * @desc Get the property data for the ownership document with the given ownership_id
   * @param ownership_id 
   */
  @Query(() => PropertyAPIResponse)
  async getPropertyForOwnership(
    @Arg("ownership_id") ownership_id: string
  ): Promise<PropertyAPIResponse>
  {

    if (!ObjectId.isValid(ownership_id)) {
      return { success: false, error: "Invalid id" }
    }

    let ownership: DocumentType<Ownership> = await OwnershipModel.findById(ownership_id) as DocumentType<Ownership>;
    if (!ownership) {
      return { success: false, error: "Ownership not found" }
    }

    // get the property
    let property: DocumentType<Property> = await PropertyModel.findById(ownership.property_id) as DocumentType<Property>;
    if (!property) return { success: false, error: "Property not found" }
  
    return { success: true, data: property }
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

  @Query(() => PropertySearchResultCollectionAPIResult)
  async searchForProperties(
    @Arg("price_start") price_start: number,
    @Arg("price_end") price_end: number,
    @Arg("rooms", type => Int) rooms: number,
    @Arg("distance") distance: number
  ): Promise<PropertySearchResultCollectionAPIResult> 
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

    let properties: {[key: string]: PropertySearchResult} = {};
    let ownerships: {[key: string]: Ownership} = {};
    let landlords: {[key: string]: Landlord} = {};

    type RatingCountInfo = {
      landlord_rating_count: number,
      property_rating_count: number
    }
    let rating_counts: {[key: string]: RatingCountInfo} = {};
    
    for (let i = 0; i < all_active_leases.length; ++i) {

      if (!Object.prototype.hasOwnProperty.call(ownerships, all_active_leases[i].ownership_id)) {
        let ownership: DocumentType<Ownership> = await OwnershipModel.findById(all_active_leases[i].ownership_id) as DocumentType<Ownership>;
        // cannot find ownership for the property that the lease is for
        if (!ownership) continue;
        ownerships[all_active_leases[i].ownership_id] = ownership;
      }

      let ownership: Ownership = ownerships[all_active_leases[i].ownership_id]!;
      if (!Object.prototype.hasOwnProperty.call(properties, ownership.property_id)) {
        let property: DocumentType<Property> = await PropertyModel.findById(ownership.property_id) as DocumentType<Property>;
        if (!property) continue;

        let new_property_result: PropertySearchResult = new PropertySearchResult();
        new_property_result.price_range = [];
        new_property_result.property = property;
        new_property_result.landlord_rating_avg = 0;
        new_property_result.property_rating_avg = 0;
        new_property_result.landlord_rating_count = 0;
        new_property_result.property_rating_count = 0;
        new_property_result.lease_count = 0;
        properties[ownership.property_id] = new_property_result;
        rating_counts[ownership.property_id] = {
          landlord_rating_count: 0,
          property_rating_count: 0
        };
      }

      // add the lease information to the search result object
      let property_result: PropertySearchResult = properties[ownership.property_id];
      property_result.lease_count += 1;

      // get the landlord information
      if (!Object.prototype.hasOwnProperty.call(landlords, ownership.landlord_id)) {
        let landlord: DocumentType<Landlord> = await LandlordModel.findById(ownership.landlord_id) as DocumentType<Landlord>;
        if (!landlord) continue;
        landlords[ownership.landlord_id] = landlord;
      }

      // add the landlord info
      property_result.landlord_first_name = landlords[ownership.landlord_id].first_name;
      property_result.landlord_last_name = landlords[ownership.landlord_id].last_name;

      // add the price_range
      if (property_result.price_range.length < 2) {
        property_result.price_range.push(all_active_leases[i].price_per_month);
        property_result.price_range.sort();
      }
      else {
        // set min price
        if (all_active_leases[i].price_per_month < property_result.price_range[0]) 
          property_result.price_range[0] = all_active_leases[i].price_per_month;

        // set max price
        if (all_active_leases[i].price_per_month > property_result.price_range[1]) 
          property_result.price_range[1] = all_active_leases[i].price_per_month;
      }

      // add the property and landlord rating aggregates
      for (let k = 0; k < all_active_leases[i].lease_history.length; ++k) {
        if (all_active_leases[i].lease_history[k].review_of_landlord != undefined) {
          rating_counts[property_result.property._id].landlord_rating_count += 1;
          property_result.landlord_rating_avg += all_active_leases[i].lease_history[k].review_of_landlord!.rating;
        }
        if (all_active_leases[i].lease_history[k].review_of_property != undefined) {
          rating_counts[property_result.property._id].property_rating_count += 1;
          property_result.property_rating_avg += all_active_leases[i].lease_history[k].review_of_property!.rating;
        }
      }

    }

    // finalize the average aggregates
    for (let i = 0; i < Object.keys(properties).length; ++i) {
      let res: PropertySearchResult = properties[Object.keys(properties)[i]];
      let rating_info: RatingCountInfo = rating_counts[Object.keys(properties)[i]];
      if (rating_info.landlord_rating_count > 0) 
        res.landlord_rating_avg = res.landlord_rating_avg / rating_info.landlord_rating_count;
      if (rating_info.property_rating_count > 0)
        res.property_rating_avg = res.property_rating_avg / rating_info.property_rating_count;

      res.landlord_rating_count = rating_info.landlord_rating_count;
      res.property_rating_count = rating_info.property_rating_count;
    }

    return {
      success: true,
      data: {
        search_results: Object.keys(properties).map((key: string) => properties[key])
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
    @Arg("property_id") property_id: string,
    @Arg("student_id") student_id: string
  ): Promise<PropertySummaryAPIResponse>
  {

    if (!ObjectId.isValid(property_id)) {
      return { success: false, error: "property does not exist." }
    }
    if (!ObjectId.isValid(student_id)) {
      return { success: false, error: "student does not exist" }
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
    
    // filter out the inactive leases
    leases_ = leases_.filter((lease_: Lease) => 
      // only consider the leases that are active (on market) ...
      lease_.active == true 
      // and the leases that the student has not declined the lease agreement for
      && !lease_.students_that_declined.map((p) => p.student_id).includes(student_id));

    // get all of the leases that the student has currently accepted
    let student: DocumentType<Student> = await StudentModel.findById(student_id) as DocumentType<Student>;
    let accepted_leases: DocumentType<Lease>[] = [];
    if (student.accepted_leases != null) {
      // filter out the leases in the accepted_leases in the student document that are not in
      // the array of leases for this property
      let promises = student.accepted_leases
        .map(y => y.lease_id)
        .filter((lease_id: string) => !(leases_.map((lease: Lease) => lease._id)).includes(lease_id)  )
        .map((lease_id: string) => LeaseModel.findById(lease_id))
      for (let i = 0; i < promises.length; ++i) {
        let res = await promises[i];
        if (res != null) accepted_leases.push(res);
      }
    }

    // leaseHasIntersection
    // attach to the summary
    summary.property = property_;
    summary.landlord = landlord_;
    summary.leases = leases_.map((lease: Lease) => {
      
      // determine if the student can lease out this property based on the time intersection
      // of all their current leases
      let able_to_lease: boolean = true;

      // compare this lease's time frame b/w all the leases that the student has accepted.
      // make sure they do not intersect
      for (let i = 0; i < accepted_leases.length; ++i) {

        // check against the lease history ...
        if (!able_to_lease) break;
        for (let j = 0; j < accepted_leases[i].lease_history.length; ++j) {
          let history_ = accepted_leases[i].lease_history[j];
          if (dateHasIntersection(
            [new Date(lease.lease_availability_start_date!), new Date(lease.lease_availability_end_date!)],
            [new Date(history_.start_date), new Date(history_.end_date)]
          )) {
            able_to_lease = false;
            break;
          }
        }

      }

      return {
        lease,
        able_to_lease
      }
    })
    
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

export const dateHasIntersection = (d1: [Date, Date], d2: [Date, Date]): boolean => {
  if (d1[0] < d2[0]) return !(d1[0] < d2[0] && d1[0] < d2[1] && d1[1] < d2[0] && d1[1] < d2[1]);
  else return !(d2[0] < d1[0] && d2[0] < d1[1] && d2[1] < d1[0] && d2[1] < d1[1]);
}

/**
 * Return true if lease1 and lease2 has any intersection
 * @param lease1 
 * @param lease2 
 */
export const leaseHasIntersection = (lease1: Lease, lease2: Lease): boolean => {
  if (lease1.lease_availability_end_date == undefined || lease1.lease_availability_start_date == undefined)
    return false;
  if (lease2.lease_availability_start_date == undefined || lease2.lease_availability_end_date == undefined)
    return false;

  let a: [Date, Date] = [new Date(lease1.lease_availability_start_date), new Date(lease1.lease_availability_end_date)];
  let b: [Date, Date] = [new Date(lease2.lease_availability_start_date), new Date(lease2.lease_availability_end_date)];

  return dateHasIntersection(a, b);
  // return !(a[0] < b[0] && a[0] < b[1] && a[1] < b[0] && a[1] < b[1]);
}