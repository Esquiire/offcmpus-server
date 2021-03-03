import {Resolver, Mutation, Arg, ObjectType, Field} from 'type-graphql';
import {StatsCollectionIDs, StudentStats, StudentStatsModel,
    LandlordStats, LandlordStatsModel, LoginDateTime} from '../entities/Statistics'
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
export class LandlordStatisticsResolver {

    @Mutation(() => StatsResponse)
    async Stats_LandlordLogin (
        @Arg("landlord_id") landlord_id: string
    ): Promise<StatsResponse>
    {
        
        let landlord_stats: DocumentType<LandlordStats> | null = await LandlordStatsModel.findOne({
            stat_collection_id: StatsCollectionIDs.LANDLORD_STATS,
            landlord_id,
            user_type: 'landlord'
        });

        // if the stats for the user do not exist, create the new document
        if (landlord_stats == null) {
            landlord_stats = new LandlordStatsModel();

            landlord_stats.landlord_id = landlord_id;
            landlord_stats.user_type = 'landlord';
            landlord_stats.stat_collection_id = StatsCollectionIDs.LANDLORD_STATS;
        }

        // add today to the list of dates logged in to the application
        if (landlord_stats.login_dates_and_times == null) {
            landlord_stats.login_dates_and_times = [];
        }

        let new_login_info = new LoginDateTime();
        new_login_info.date_time = new Date().toISOString();
        new_login_info.device_type = 'desktop';
        new_login_info.user_agent = 'placeholder';

        landlord_stats.login_dates_and_times.push(new_login_info);
        landlord_stats.save();

        return { v: '0.0.1' }
    }

};