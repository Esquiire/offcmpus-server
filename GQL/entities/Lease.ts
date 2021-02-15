import { prop, getModelForClass } from "@typegoose/typegoose"
import { Field, ObjectType, InputType, ID, Int, Float } from "type-graphql"
import { Student } from './Student'
import { Property } from './Property'
import { Landlord } from './Landlord'
import { Institution } from './Institution'
import { LeaseDocument } from './LeaseDocument'
import {APIResult} from "."
import { DocumentType } from "@typegoose/typegoose"
import mongoose from 'mongoose'

/**
 * Review & Response
 * @desc This object is used to describe a review that is made
 * by a student. For each review, the authorized landlord can respond
 * to the review.
 */
@ObjectType({description: "Review & Response"})
export class ReviewAndResponse {

    // The rating is a float in the range [0, 1]
    @Field(type => Float)
    @prop({type: Number})
    rating: number;

    @Field(type => String)
    @prop({type: String})
    review: string;

    @Field(type => String, {nullable: true})
    @prop({type: String})
    response?: string;
}

@ObjectType({description: "Student interest object"})
export class StudentInterest {

    /**
     * The id of the student that expressed interest for the
     * property.
     */
    @Field(type => String)
    @prop({type: String})
    student_id: string;

    /**
     * The date that the student expressed their interest
     * for the property.
     */
    @Field(type => String)
    @prop({type: String})
    date: string;

    /**
     * If this is set, it describes whether the landlord has accepted
     * the student's request to take the lease.
     * If not set, then no decision has been made yet.
     */
    @Field(type => Boolean, {nullable: true})
    @prop({type: Boolean})
    accepted?: boolean;

}

@ObjectType({description: "Property Image info"})
export class LeaseImageInfo {
  @Field(type => String)
  @prop({type: String})
  s3_key: string;

  @Field(type => String)
  @prop({type: String})
  date_uploaded: string;
}

/**
 * LeaseHistory
 * @desc This object is used to describe an instance in which a room for
 * a property is currently or has previously been leased out. 
 */
@ObjectType({description: "Information about an instance of a lease's activation"})
export class LeaseHistory {

    // The price leased out for in USD
    @Field(type => Float)
    @prop({type: Number})
    price: number;

    // A reference to the student that leased the property out
    @Field(type => String)
    @prop({type: String})
    student_id: string;

    // The date the lease started
    @Field(type => String)
    @prop({type: String})
    start_date: string;

    // The date the lease ended
    @Field(type => String)
    @prop({type: String})
    end_date: string;

    // the review of the property, by the student
    @Field(type => ReviewAndResponse, {nullable: true})
    @prop({type: ReviewAndResponse})
    review_of_property?: ReviewAndResponse;

    // the review of the landord, by the student
    @Field(type => ReviewAndResponse, {nullable: true})
    @prop({type: ReviewAndResponse})
    review_of_landlord?: ReviewAndResponse;

    // the s3 keys for the images uploaded by the student
    // leasing out the property
    @Field(type => [LeaseImageInfo])
    @prop({type: [LeaseImageInfo]})
    property_images: LeaseImageInfo[];
}

@ObjectType()
export class LeaseHistorySummary {
    
    @Field(type => Property)
    property: Property;

    @Field(type => Lease)
    lease: Lease;

    @Field(type => Landlord)
    landlord: Landlord;

    @Field(type => LeaseHistory)
    lease_history: LeaseHistory;

    @Field(type => Int)
    room_no: number;

    @Field(type => String)
    lease_history_id: string;
}

@ObjectType()
export class LeaseHistorySummaryCollection {

    @Field(type => [LeaseHistorySummary])
    histories: LeaseHistorySummary[];
}

@ObjectType()
export class LeaseHistorySummaryAPIResponse extends APIResult(LeaseHistorySummary) {}

@ObjectType()
export class LeaseHistorySummaryCollectionAPIResponse extends APIResult(LeaseHistorySummaryCollection) {}

@ObjectType({description: "Object model for the priority object for a lease"})
export class LeasePriority {
    
    // The priority level for this priority object.
    @Field(type => Int)
    @prop({type: Number})
    level: number;

    // The date that this priority status is active from
    @Field(type => String)
    @prop({type: String})
    start_date: string;

    // The date that this priority status is active until
    @Field(type => String)
    @prop({type: String})
    end_date: string;
}

@ObjectType()
class DeclineInfo {

    @Field(() => String)
    @prop({type: String})
    date: string;

    @Field(() => String)
    @prop({type: String})
    student_id: string;
}

@ObjectType({description: "Schema for the Lease document"})
export class Lease {

    @Field(() => ID)
    _id: string;

    /**
     * If active is true, then this lease is on the market / available
     * for grabs.
     * Otherwise, students should not be able to see this lease available.
     */
    @Field(() => Boolean)
    @prop({type: Boolean})
    active: boolean;

    // The id to the ownership document that this lease
    // is created for.
    @Field(() => String)
    @prop({type: String})
    ownership_id: string;

    // Price for the lease in USD
    @Field(() => Float)
    @prop({type: Number})
    price_per_month: number;

    // The id for the student occupying this lease
    @Field(() => String, {nullable: true})
    @prop({type: String})
    occupant_id?: string;

    // Field to store the occupant document that corresponds to 
    // the student with occupant_id
    @Field(() => Student, {nullable: true})
    occupant_doc?: Student;

    // Defines whether this lease is occupied by means not 
    // provided through this application.
    @Field(() => Boolean)
    @prop({type: Boolean})
    external_occupant: boolean;

    // The priority defenition for this lease. This is provided if the
    // landlord pays finder's premium. Otherwise this should be null.
    // It describes how this lease should be served to students. 
    @Field(() => LeasePriority, {nullable: true})
    @prop({type: LeasePriority})
    priority?: LeasePriority;

    // The lease document files that identify what is allowed on this
    // lease. This is the document that students will sign to accept 
    // accept a lease.
    @Field(() => String, {nullable: true})
    @prop({type: String})
    lease_document_id?: string;

    @Field(() => String, {nullable: true})
    @prop({type: String})
    lease_availability_start_date?: string;

    @Field(() => String, {nullable: true})
    @prop({type: String})
    lease_availability_end_date?: string;

    // The list of history for which this property was leased out for
    @Field(type => [LeaseHistory])
    @prop({type: [LeaseHistory]})
    lease_history: LeaseHistory[];

    // All of the students that have expressed interest for this lease
    @Field(type => [StudentInterest])
    @prop({type: [StudentInterest]})
    student_interests: StudentInterest[];

    // The students that have declined the lease agreement
    @Field(type => [DeclineInfo], {nullable: true})
    @prop({type: [DeclineInfo]})
    students_that_declined: DeclineInfo[];
}

@ObjectType({description: "Summary of lease information"})
export class LeaseSummary {

    // The room number this lease is for in the property
    @Field(type => Int)
    @prop({type: Int})
    room_no: number;

    // The property that this lease is for
    @Field(type => Property)
    @prop({type: Property})
    property: Property;

    // The lease document for this lease summary
    @Field(type => Lease)
    @prop({type: Lease})
    lease: Lease;

    // The list of all the institutions that all of the
    // students who expressed interest aree from.
    @Field(type => [Institution])
    @prop({type: [Institution]})
    institutions: Institution[];

    // The array os students that are referenced somewhere
    // in this summary (e.g in the StudentInterest within the
    // lease)
    @Field(type => [Student])
    @prop({type: [Student]})
    students: Student[];

    @Field(type => LeaseDocument, {nullable: true})
    @prop({type: LeaseDocument})
    lease_doc?: LeaseDocument;
}

@ObjectType({description: "A collection of leases"})
class LeaseCollection {

    @Field(type => [Lease])
    @prop({type: [Lease]})
    leases: Lease[];
}

@ObjectType()
class Digit {

    @Field(type => Number)
    value: number;
}

@ObjectType({description: "API Response class for the Lease object."})
export class LeaseAPIResponse extends APIResult(Lease) {}

@ObjectType({description: "Represents a digit"})
export class DigitAPIResponse extends APIResult(Digit) {}

@ObjectType({description: "API Response for lease summary"})
export class LeaseSummaryAPIResponse extends APIResult(LeaseSummary) {}

@ObjectType({description: "API Response class for Lease collection object"})
export class LeaseCollectionAPIResponse extends APIResult(LeaseCollection) {}

export const LeaseModel = getModelForClass(Lease)

// Input Types
@InputType({description: "Input for describing the creation of a lease"})
export class LeaseUpdateInput {

    @Field(() => String)
    @prop({type: String})
    lease_id: string;

    @Field(() => Float, {nullable: true})
    @prop({type: Number})
    price_per_month?: number;

    @Field(() => Boolean, {nullable: true})
    @prop({type: Boolean})
    external_occupant?: boolean;

    @Field(() => Boolean, {nullable: true})
    @prop({type: Boolean})
    active?: boolean;

    // Input fields for describing the lease priority information
    @Field(() => Int, {nullable: true})
    @prop({type: Number})
    lease_priority?: number;

    @Field(() => String, {nullable: true})
    @prop({type: String})
    priority_start_date?: string;

    @Field(() => String, {nullable: true})
    @prop({type: String})
    priority_end_date?: string;
}

/**
 * Create an empty lease that is for the ownership id with the
 * provided ownership_id document
 * @param ownership_id The id of the ownership document to create
 * the lease document for
 */
export const createEmptyLease = async (
    {for_ownership_id}: {for_ownership_id: string}): Promise<DocumentType<Lease>> => {

    let lease_ = new LeaseModel();
    lease_.ownership_id = for_ownership_id;
    // leases are inactive by default. The landlord must
    // activate them.
    lease_.active = false;
    lease_.external_occupant = false;
    lease_.price_per_month = 0;
    return lease_.save() as Promise<DocumentType<Lease>>;
}