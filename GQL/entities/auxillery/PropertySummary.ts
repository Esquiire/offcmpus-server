import {prop, getModelForClass} from "@typegoose/typegoose"
import {Field, ObjectType, ArgsType, ID, InputType, Int} from "type-graphql"
import {APIResult} from ".."
import {Property} from '../Property'
import {Landlord} from '../Landlord'
import {Lease} from '../Lease'

/**
 * The PropertyInfo is meant to capture all the components that go into
 * describing the property to students, including the landlord that owns the
 * property, the amount of available leases, description of the property, and
 * reviews for the property
*/
@ObjectType()
export class PropertySummary {

    @Field(type => Property)
    property: Partial<Property>;

    @Field(type => [Lease])
    leases: Partial<Lease>[];

    @Field(type => Landlord)
    landlord: Partial<Landlord>;
}

@ObjectType()
export class PropertySummaryAPIResponse extends APIResult(PropertySummary) {}