import {Resolver, Ctx, Mutation, Arg, ObjectType, Field} from 'type-graphql';
import {StatsCollectionIDs, StudentStats, StudentStatsModel,
    LandlordStats, LandlordStatsModel, LoginDateTime, STATS_API_VERSION,
    StudentAccountCreationStats} from '../entities/Statistics'
import {Student, StudentModel} from '../entities/Student'
import {Institution, InstitutionModel} from '../entities/Institution'
import {DocumentType} from "@typegoose/typegoose"
import mongoose from 'mongoose'
const ObjectId = mongoose.Types.ObjectId

/**
 * Student Statistics API Resolvers
 * 
 */
@ObjectType()
export class StatsResponse { 
    // the version of the statistics api being used.
    @Field(type => String)
    v: string 
}

@Resolver()
export class StudentStatisticsResolver {

    /**
     * @desc Create stats for this student and store the
     * time/date + the insitution the student creted the account
     * for.
     * @param student_id 
     */
    @Mutation(() => StatsResponse)
    async Stats_StudentAccountCreation (
        @Ctx() context: any
    ): Promise<StatsResponse>
    {

        if (!context.req.user) return {v: '0'};
        let student_id = context.req.user._id;

        if (!ObjectId.isValid(student_id)) return { v: '0' };
        // make sure their info is not already instiantiated
        let new_student_info: DocumentType<StudentStats> | null = await StudentStatsModel.findOne({
            stat_collection_id: StatsCollectionIDs.USER_STATS,
            student_id,
            user_type: 'student'
        });

        if (new_student_info != null) return { v: '0' };

        // get the institution their account is associated with
        let student_: DocumentType<Student> | null = await StudentModel.findById(student_id);
        if (student_ == null) return { v: '0' };

        let institution: DocumentType<Institution> | null = await InstitutionModel.findById(
            student_.auth_info.institution_id
        );
        if (institution == null) return { v: '0' };

        let creation_info = new StudentAccountCreationStats();
        creation_info.date_time = new Date().toISOString();
        creation_info.institution = institution.name;

        new_student_info = new StudentStatsModel();
        new_student_info.stat_collection_id = StatsCollectionIDs.USER_STATS;
        new_student_info.student_id = student_id;
        new_student_info.user_type = 'student';
        new_student_info.creation = creation_info;

        new_student_info.save();

        return {v: STATS_API_VERSION};

    }

    /**
     * @desc Log the times a student logs into the application
     * @param student_id The id of the student logging in
     */
    @Mutation(() => StatsResponse)
    async Stats_StudentLogin (
        @Ctx() context: any
    ): Promise<StatsResponse>
    {

        let student_id = context.req.user._id;
        if (!ObjectId.isValid(student_id)) return {v: '0'};
        
        let student_stats: DocumentType<StudentStats> | null = await StudentStatsModel.findOne({
            stat_collection_id: StatsCollectionIDs.USER_STATS,
            student_id,
            user_type: 'student'
        });

        // if the stats for the user do not exist, create the new document
        if (student_stats == null) {
            return {v: '0'}
        }

        // add today to the list of dates logged in to the application
        if (student_stats.login_dates_and_times == null) {
            student_stats.login_dates_and_times = [];
        }

        let new_login_info = new LoginDateTime();
        new_login_info.date_time = new Date().toISOString();
        new_login_info.device_type = 'desktop';
        new_login_info.user_agent = 'placeholder';

        student_stats.login_dates_and_times.push(new_login_info);
        student_stats.save();

        return { v: STATS_API_VERSION }
    }

};