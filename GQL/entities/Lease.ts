import { prop, getModelForClass } from "@typegoose/typegoose"
import { Field, ObjectType, ID, Int, Float } from "type-graphql"
import { Student } from './Student'
import {APIResult} from "."

@ObjectType({description: "Object model for the priority object for a lease"})
class LeasePriority {
    
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

@ObjectType({description: "Schema for the Lease document"})
export class Lease {

    @Field(() => String)
    @prop({type: String})
    _id: string;

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
    occupant_id: string;

    // Field to store the occupant document that corresponds to 
    // the student with occupant_id
    @Field(() => Student, {nullable: true})
    @prop({type: Student})
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
}

@ObjectType({description: "A collection of leases"})
class LeaseCollection {

    @Field(type => [Lease])
    @prop({type: [Lease]})
    leases: Lease[];
}

@ObjectType({description: "API Response class for the Lease object."})
export class LeaseAPIResponse extends APIResult(Lease) {}

@ObjectType({description: "API Response class for Lease collection object"})
export class LeaseCollectionAPIResponse extends APIResult(LeaseCollection) {}

export const LeaseModel = getModelForClass(Lease)