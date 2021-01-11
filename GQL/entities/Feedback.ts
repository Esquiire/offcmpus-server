import {prop, getModelForClass} from "@typegoose/typegoose"
import {Field, ObjectType, ArgsType, ID, InputType, Int} from "type-graphql"
import {APIResult} from "."

@ObjectType({description: "Feedback submission entry"})
export class Feedback {

    @Field(type => String)
    @prop({type: String})
    submitter_id: string;

    @Field(type => String)
    @prop({type: String})
    user_type: 'landlord' | 'student';

    @Field(type => String)
    @prop({type: String})
    message: string;

    @Field(type => String)
    @prop({type: String})
    date_submitted: string;

    @Field(type => [String])
    @ prop({type: [String]})
    tags: string[];
}

@ObjectType({description: "a collection of feedback response"})
export class FeedbackCollection{
    @Field(type => [Feedback])
    @prop({type: [Feedback]})
    feedback_collection: Feedback[]
}

@ObjectType()
export class FeedbackAPIResponse extends APIResult(Feedback) {}
@ObjectType()
export class FeedbackCollectionAPIResponse extends APIResult(FeedbackCollection) {}

export const FeedbackModel = getModelForClass(Feedback)