import {Resolver, Mutation, Arg, Args, Query} from 'type-graphql'
import {DocumentType} from '@typegoose/typegoose'
import {Lease, LeaseModel, LeaseUpdateInput, LeasePriority,
    LeaseCollectionAPIResponse, LeaseAPIResponse} from '../entities/Lease'
import {Ownership, OwnershipModel} from '../entities/Ownership'
import {Student, StudentModel} from '../entities/Student'
import mongoose, {DocumentQuery} from 'mongoose'

const ObjectId = mongoose.Types.ObjectId
type Query_<T> = DocumentQuery<DocumentType<T> | null, DocumentType<T>, {}>

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
        
        console.log(`Querying Leases for ownership: ${ownership_id}`);

        if (!ObjectId.isValid(ownership_id)) {
            console.log(`Ownership id is invalid...`)
            return {
                success: false,
                error: "Invalid ownership id provided"
            }
        }
        let leases: DocumentType<Lease>[] = await LeaseModel.find({ownership_id}) as DocumentType<Lease>[]
        console.log("Lease Documents.")
        console.log(leases)

        let occupants: ([number, Query_<Student>])[] = [];

        // initialize each of the qeury searches asynchronously
        for (let i = 0; i < leases.length; ++i) {
            // if the lease has no occupant data or has an external occupant, pass a null promise resolver
            if (leases[i].occupant_id == undefined || leases[i].external_occupant)
                continue;
            occupants.push([i, StudentModel.findById(leases[i].occupant_id) ]);
        }

        // wait for all of the queries to resolve
        for (let i = 0; i < occupants.length; ++i) {

            let student: DocumentType<Student> = await occupants[i][1] as DocumentType<Student>;
            leases[ occupants[i][0] ].occupant_doc = student;
        }

        return { success: true, data: {leases} }
    }

    /**
     * updateUnoccupiedLeases
     * @desc Update multiple lease documents that are for a specific ownership document. This mutator
     * strictly modified unoccupied leases.
     * @param ownership_id The id of the ownership document that these leases belong to
     * @param leases_info An array of LeaseUpdateInput that describes the changes to be made to their respective
     * lease documents.
     * 
     * @returns All lease documents modified by this mutation's instance will be returned.
     */
    @Mutation(returns => LeaseCollectionAPIResponse)
    async updateUnoccupiedLeases
    (   @Arg("ownership_id") ownership_id: string,
        @Arg("leases_info", type => [LeaseUpdateInput]) leases_info: LeaseUpdateInput[]): Promise<LeaseCollectionAPIResponse> {

            let leases: ([Query_<Lease>, LeaseUpdateInput])[] = [];

            // find all the leases we want to modify
            for (let i = 0; i < leases_info.length; ++i) leases.push( [LeaseModel.findById(leases_info[i].lease_id), leases_info[i]] );

            let modified: DocumentType<Lease>[] = [];
            // apply the modification as the promises are resolving
            for (let i = 0; i < leases.length; ++i) {
                let lease_: DocumentType<Lease> = await leases[i][0] as DocumentType<Lease>;
                if (lease_.occupant_id != undefined) continue;

                // if we supply true external_occupant, then we are effectively disabling this lease
                // from being on the offcmpus market
                let lease_update_info: LeaseUpdateInput = leases[i][1];
                let modified_: boolean = false;
                if (lease_update_info.external_occupant == true) {
                    lease_.external_occupant = true;
                    lease_.priority = undefined;
                    lease_.occupant_id = undefined;
                    lease_.price_per_month = -1;
                    
                    modified_ = true;
                }

                // process the changes to price per month and priority of the lease
                else {
                    // update the price & priority information
                    if (lease_update_info.price_per_month != undefined) {
                        lease_.price_per_month = lease_update_info.price_per_month;
                        modified_ = true;
                    }
                    if (lease_update_info.lease_priority != undefined
                        && lease_update_info.priority_start_date != undefined
                        && lease_update_info.priority_end_date != undefined) {
                        
                        lease_.priority = new LeasePriority();
                        lease_.priority.level = lease_update_info.lease_priority;
                        lease_.priority.start_date = lease_update_info.priority_start_date;
                        lease_.priority.end_date = lease_update_info.priority_start_date;

                        modified_ = true;
                    }
                    if (lease_update_info.active != undefined) {
                        lease_.active = lease_update_info.active;
                        modified_ = true;
                    }
                }

                // save and update modified
                if (modified_) {
                    lease_.save();
                    modified.push(lease_);
                }
            }

            return {
                success: true,
                data: { leases: modified }
            }

    }
}