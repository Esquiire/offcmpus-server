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

export const STATS_API_VERSION = '0.0.1';

export const StatsCollectionIDs = {
    USER_STATS: 'user_statistics_coll',
    LANDLORD_STATS: 'landlord_statistics_coll'
};

export class LeaseCreationStat {

    // the property id that the lease was created for
    @Field(type => String)
    @prop({type: String})
    for_property: string;

    // the lease_if that was created
    @Field(type => String)
    @prop({type: String})
    for_lease: string;

    @Field(type => Boolean)
    @prop({type: Boolean})
    has_active_promo: boolean;

    @Field(type => String)
    @prop({type: String})
    date_time: string;
}

export class LoginDateTime {

    @Field(type => String)
    @prop({type: String})
    date_time: string;

    @Field(type => String)
    @prop({type: String})
    device_type: 'mobile' | 'desktop';

    @Field(type => String)
    @prop({type: String})
    user_agent: string;
}

export class StudentAccountCreationStats {

    @Field(type => String)
    @prop({type: String})
    date_time: string;

    @Field(type => String)
    @prop({type: String})
    institution: string;
}

export class StudentStats {

    @Field(type => String)
    @prop({type: String})
    stat_collection_id: string;

    @Field(type => String)
    _id: string;

    @Field(type => StudentAccountCreationStats)
    @prop({type: StudentAccountCreationStats})
    creation: StudentAccountCreationStats;

    @Field(type => String)
    @prop({type: String})
    user_type: 'student';

    @Field(type => String)
    @prop({type: String})
    student_id: string;

    @Field(type => [LoginDateTime], {nullable: true})
    @prop({type: [LoginDateTime]})
    login_dates_and_times?: LoginDateTime[]
}

export class LandlordStats {

    @Field(type => String)
    @prop({type: String})
    stat_collection_id: string;

    @Field(type => String)
    _id: string;

    @Field(type => String)
    @prop({type: String})
    creation: string;

    @Field(type => String)
    @prop({type: String})
    date_created: string;

    @Field(type => String)
    @prop({type: String})
    user_type: 'landlord';

    @Field(type => String)
    @prop({type: String})
    landlord_id: string;

    @Field(type => [LoginDateTime], {nullable: true})
    @prop({type: [LoginDateTime]})
    login_dates_and_times?: LoginDateTime[];

    @Field(type => [LeaseCreationStat], {nullable: true})
    @prop({type: [LeaseCreationStat]})
    lease_creations: LeaseCreationStat[];
}

export const StudentStatsModel = getModelForClass(StudentStats, {
    schemaOptions: { collection: 'statistics' }
})

export const LandlordStatsModel = getModelForClass(LandlordStats, {
    schemaOptions: { collection: 'statistics' }
})