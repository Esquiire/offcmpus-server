import {Resolver, Mutation, Arg, ObjectType, Field} from 'type-graphql';
import {StatsCollectionIDs, StudentStats, StudentStatsModel,
    LandlordStats, LandlordStatsModel, LoginDateTime, LeaseCreationStat,
    STATS_API_VERSION} from '../entities/Statistics'
import {Landlord, LandlordModel} from '../entities/Landlord'
import {DocumentType} from "@typegoose/typegoose"
import mongoose from 'mongoose'
import {hasPromo} from '../entities/Lease'
const ObjectId = mongoose.Types.ObjectId

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
    async Stats_LandlordAccountCreation (
        @Arg("landlord_id") landlord_id: string
    ): Promise<StatsResponse>
    {

        if (!ObjectId.isValid(landlord_id)) return {v: '0'};

        // make sure the landlord exists
        let landlord: DocumentType<Landlord> | null = await LandlordModel.findById(landlord_id);
        if (landlord == null) return {v: '0'};
        
        // make sure there isn't already a document stats object for this user
        let landlord_stats: DocumentType<LandlordStats> | null = await LandlordStatsModel.findOne({
            stat_collection_id: StatsCollectionIDs.LANDLORD_STATS,
            landlord_id,
            user_type: 'landlord'
        });
        if (landlord_stats != null) return {v: '0'};

        // create the new landlord stats object
        landlord_stats = new LandlordStatsModel();
        
        landlord_stats.landlord_id = landlord_id;
        landlord_stats.user_type = 'landlord';
        landlord_stats.stat_collection_id = StatsCollectionIDs.LANDLORD_STATS;
        landlord_stats.creation = new Date().toISOString();

        landlord_stats.save();
        return { v: STATS_API_VERSION }
        
    }

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
            return {v: '0'}
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

        return { v: STATS_API_VERSION }
    }

    /**
     * @desc Keep track of the leases that are opened, and
     * at what times.
     */
    @Mutation(() => StatsResponse)
    async Stats_LandlordOpenLease (
        @Arg("landlord_id") landlord_id: string,
        @Arg("property_id") property_id: string,
        @Arg("lease_id") lease_id: string
    ): Promise<StatsResponse>
    {

        if (!ObjectId.isValid(landlord_id) || !ObjectId.isValid(property_id)
        || !ObjectId.isValid(lease_id))
            return { v: '0' };

        // get the stats for the landlord
        let landlord_stats: DocumentType<LandlordStats> | null = await LandlordStatsModel.findOne({
            stat_collection_id: StatsCollectionIDs.LANDLORD_STATS,
            landlord_id,
            user_type: 'landlord'
        });
        if (!landlord_stats) return { v: '0' }

        if (landlord_stats.lease_creations == null)
            landlord_stats.lease_creations = [];

        // check the lease document to see whether there is an active promo.
        let has_promo = await hasPromo(lease_id);
        // if we get null, then the lease does not exist
        if (has_promo == null) return { v: '0' }

        let stats_ = new LeaseCreationStat();
        stats_.for_property = property_id;
        stats_.for_lease = lease_id;
        stats_.has_active_promo = has_promo;
        stats_.date_time = new Date().toISOString();

        // add the stat to the document
        landlord_stats.lease_creations.push(stats_);
        landlord_stats.save();

        return { v: STATS_API_VERSION }

    }

};