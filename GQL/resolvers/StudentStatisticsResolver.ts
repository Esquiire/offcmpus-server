import {Resolver, Mutation, Arg, ObjectType, Field} from 'type-graphql';
import {StatsCollectionIDs, StudentStats, StudentStatsModel,
    LandlordStats, LandlordStatsModel, LoginDateTime, STATS_API_VERSION} from '../entities/Statistics'
import {DocumentType} from "@typegoose/typegoose"

/**
 * Student Statistics API Resolvers
 * 
 */
@ObjectType()
class StatsResponse { 
    // the version of the statistics api being used.
    @Field(type => String)
    v: string 
}

@Resolver()
export class StudentStatisticsResolver {


    /**
     * @desc Log the times a student logs into the application
     * @param student_id The id of the student logging in
     */
    @Mutation(() => StatsResponse)
    async Stats_StudentLogin (
        @Arg("student_id") student_id: string
    ): Promise<StatsResponse>
    {
        
        let student_stats: DocumentType<StudentStats> | null = await StudentStatsModel.findOne({
            stat_collection_id: StatsCollectionIDs.USER_STATS,
            student_id,
            user_type: 'student'
        });

        // if the stats for the user do not exist, create the new document
        if (student_stats == null) {
            student_stats = new StudentStatsModel();

            student_stats.student_id = student_id;
            student_stats.user_type = 'student';
            student_stats.stat_collection_id = StatsCollectionIDs.USER_STATS;
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