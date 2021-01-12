import {Resolver, Mutation, Arg, Query,Subscription,PubSub,Root,Args} from 'type-graphql'
import {DocumentType} from "@typegoose/typegoose"
import mongoose from 'mongoose'
import { PubSubEngine } from "graphql-subscriptions";
import chalk from 'chalk'
import {
    Feedback,
    FeedbackModel,
    FeedbackAPIResponse,
    FeedbackCollection,
    FeedbackCollectionAPIResponse
} from '../entities/Feedback'

const ObjectId = mongoose.Types.ObjectId

interface FeedbackPayload{
    feedback: Feedback
}

@Resolver()
export class FeedbackResolver {

    @Subscription(returns => Feedback,
        {topics: "FEEDBACKS"}
    )
    async newFeedback(
        @Root() {feedback}: FeedbackPayload,
    ): Promise<Feedback>{
        return{
            submitter_id : feedback.submitter_id,
            user_type : feedback.user_type,
            message : feedback.message,
            date_submitted : feedback.date_submitted,
            tags: feedback.tags
        }
    }

    @Query(() => FeedbackCollectionAPIResponse)
    async getFeedback(
        @Arg("offset") offset: number,
        @Arg("limit") limit: number): Promise<FeedbackCollectionAPIResponse>
        {
            let feedbacks: DocumentType <Feedback>[] = await FeedbackModel.find().skip(offset).limit(limit) as DocumentType <Feedback>[]
            return {
                success: true,
                data: {
                    feedback_collection: feedbacks
                }
            }

        }
    /**
     * submitFeedback()
     * @desc Create a new feedback entry with the message, submitter info,
     * and tags describing the category the feedback belongs in.
     * 
     * @param submitter_id: string => The id of the submitter
     * @param user_type: string => The type of the user (student | landlord)
     * @param message: string => The string message of the feedbck
     * @param tags: string[] => The tags associated with the feedback entry
     */
    @Mutation(() => FeedbackAPIResponse)
    async submitFeedback(
        @Arg("submitter_id") submitter_id: string,
        @Arg("user_type") user_type: string,
        @Arg("message") message: string,
        @Arg("tags", type => [String]) tags: string[],
        @PubSub() pubSub: PubSubEngine): Promise<FeedbackAPIResponse>
        {

            console.log(chalk.bgBlue(`👉 submitFeedback()`))
            console.log(`user type => ${user_type}`)

            if (user_type != 'landlord' && user_type != 'student') {
                console.log(chalk.bgRed(`❌ Error: User type must be landlord or student.`))
                return {
                    success: false,
                    error: "Invalid user type"
                }
            }

            let new_feedback: DocumentType<Feedback> = new FeedbackModel()
            new_feedback.submitter_id = submitter_id;
            new_feedback.user_type = user_type;
            new_feedback.message = message;
            new_feedback.tags = tags;
            new_feedback.date_submitted = new Date().toISOString()

            let saved_feedback: DocumentType<Feedback> = await new_feedback.save();
            if (saved_feedback) {
                console.log(chalk.bgGreen(`✔ Successfully created new feedback!`))
                //TRIGGER NEW SUBSCRIPTION TOPIC FEEDBACKS
                
                await pubSub.publish("FEEDBACKS", {feedback : saved_feedback});
                return {
                    success: true,
                    data: saved_feedback
                }
            }

            else {
                console.log(chalk.bgRed(`❌ Error: Problem creating new feedback`))
                return {
                    success: false,
                    error: "Internal server error"
                }
            }

        }
}