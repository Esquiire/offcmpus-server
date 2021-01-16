import {Resolver, Mutation, Arg, Args, Query} from 'type-graphql'
import {DocumentType} from '@typegoose/typegoose'
import {Lease, LeaseModel, 
    LeaseCollectionAPIResponse, LeaseAPIResponse} from '../entities/Lease'
import {Ownership, OwnershipModel} from '../entities/Ownership'
import mongoose from 'mongoose'

const ObjectId = mongoose.Types.ObjectId

@Resolver()
export class LeaseResolver {
 
    /**
     * Given an id to a ownership document, find all leases that correspond
     * to this document and their occupant student documents, if they are not null.
     * @param ownership_id The id of the ownership document to get the leases for 
     */
    @Query(returns => LeaseCollectionAPIResponse)
    async getLeasesAndOccupants 
    (@Arg("ownership_id") ownership_id: string): Promise<LeaseCollectionAPIResponse> {
        
        if (!ObjectId.isValid(ownership_id)) {
            return {
                success: false,
                error: "Invalid ownership id provided"
            }
        }
        let leases: DocumentType<Lease>[] = await LeaseModel.find({ownership_id}) as DocumentType<Lease>[]
        return {
            success: true,
            data: {
                leases
            }
        }

    }
}