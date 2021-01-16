import {Resolver, Mutation, Arg, Args, Query} from 'type-graphql'
import {DocumentType} from '@typegoose/typegoose'
import {Lease, LeaseModel, 
    LeaseCollectionAPIResponse, LeaseAPIResponse} from '../entities/Lease'
import {Ownership, OwnershipModel} from '../entities/Ownership'
import {Student, StudentModel} from '../entities/Student'
import mongoose, {DocumentQuery} from 'mongoose'

const ObjectId = mongoose.Types.ObjectId
type StudentQuery = DocumentQuery<DocumentType<Student> | null, DocumentType<Student>, {}>

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
        let occupants: ([number, StudentQuery])[] = [];

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

        return {
            success: true,
            data: {
                leases
            }
        }

    }
}