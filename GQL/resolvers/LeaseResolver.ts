import {Resolver, Mutation, Arg, Args, Query} from 'type-graphql'
import {DocumentType} from '@typegoose/typegoose'
import {Lease, LeaseModel, LeaseUpdateInput, LeasePriority, ReviewAndResponse,
    StudentInterest, LeaseCollectionAPIResponse, LeaseAPIResponse, 
    LeaseSummaryAPIResponse,
    DigitAPIResponse, LeaseHistory, LeaseSummary} from '../entities/Lease'
import {Ownership, OwnershipModel} from '../entities/Ownership'
import {Property, PropertyModel, getAddress} from '../entities/Property'
import {Student, StudentModel} from '../entities/Student'
import {Institution, InstitutionModel} from '../entities/Institution'
import {Landlord, LandlordModel} from '../entities/Landlord'
import {LeaseDocument, LeaseDocumentModel} from '../entities/LeaseDocument'
import mongoose, {DocumentQuery} from 'mongoose'
import {frontendPath} from '../../config'
import SendGrid, {SendGridTemplate} from '../../vendors/SendGrid'
import {NotificationsAPI} from '../../modules/NotificationsAPI'

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
     * @desc Get the summary for the lease with the given lease
     * id.
     * @param property_id 
     * @param lease_id 
     */
    @Query(returns => LeaseSummaryAPIResponse)
    async getLeaseSummary(
        @Arg("lease_id") lease_id: string
    ): Promise<LeaseSummaryAPIResponse>
    {

        if (!ObjectId.isValid(lease_id)) {
            return {
                success: false,
                error: "Invalid id"
            }
        }

        let lease_: DocumentType<Lease> = await LeaseModel.findById(lease_id) as DocumentType<Lease>;
        if (lease_ == undefined) {
            return {
                success: false,
                error: "Does not exist"
            }
        }

        // get the ownership
        let ownership: DocumentType<Ownership> = await OwnershipModel.findById(lease_.ownership_id) as DocumentType<Ownership>;
        if (ownership == undefined) {
            return {
                success: false,
                error: "No ownership found"
            }
        }

        // get the property for the ownership
        let property: DocumentType<Property> = await PropertyModel.findById(ownership.property_id) as DocumentType<Property>;
        if (property == undefined) {
            return {
                success: false,
                error: "No property found"
            }
        }

        // find the lease room number
        let room_no: number = -1;
        let leases_: DocumentType<Lease>[] = await LeaseModel.find({
            ownership_id: ownership._id
        }) as DocumentType<Lease>[];

        let i = 0;
        while (i < leases_.length && leases_[i]._id.toString() != lease_._id.toString()) ++i;
        
        if (i == leases_.length) room_no = -1; // could not find the lease in the query
        else room_no = i + 1;

        // create the lease summary
        let summary: LeaseSummary = new LeaseSummary();
        summary.property = property;
        summary.lease = lease_;
        summary.room_no = room_no;
        summary.students = [];
        summary.institutions = [];

        // get the lease document
        if (lease_.lease_document_id) {
            let doc: DocumentType<LeaseDocument> = await LeaseDocumentModel.findById(lease_.lease_document_id) as DocumentType<LeaseDocument>;
            if (doc != undefined) {
                summary.lease_doc = doc;
            }
        }

        // get all the students that are referenced in the student interests
        let students: DocumentQuery<DocumentType<Student> | null, DocumentType<Student>, {}>[] = [];
        lease_.student_interests.forEach((interest: StudentInterest) => {
            students.push(StudentModel.findById(interest.student_id));
        });

        let institutions: {[key: string]: DocumentQuery<DocumentType<Institution> | null, DocumentType<Institution>, {}>} = {};

        for (let i = 0; i < students.length; ++i) {

            let student_query = students[i];
            let student_: DocumentType<Student> | null = await student_query;
            if (student_ != null) {
                summary.students.push(student_);
                // get the institution, if it has not previously been queried
                if (!Object.prototype.hasOwnProperty.call(institutions, student_.auth_info.institution_id.toString())) {
                    institutions[student_.auth_info.institution_id.toString()] = InstitutionModel.findById(
                        student_.auth_info.institution_id.toString()
                    );
                }
            }
            
        }
        
        // get all of the institutions that are for the students
        // that express interest in this property
        for (let i = 0; i < Object.keys(institutions).length; ++i) {
            let institution_id = Object.keys(institutions)[i];
            let institution: DocumentType<Institution> | null = await institutions[institution_id];
            if (institution != null) {
                summary.institutions.push(institution);
            }
        }

        // return the summary.
        return {
            success: true,
            data: summary
        }
    }

    @Mutation(returns => LeaseAPIResponse)
    async activateLease (

        // the id of the lease we are activating
        @Arg("lease_id") lease_id: string,

        // The id of the document object that holds the file information
        // for leases uploaded.
        @Arg("lease_document_id") lease_document_id: string,

        @Arg("price_per_month") price_per_month: number,
        @Arg("lease_start_date") lease_start_date: string,
        @Arg("lease_end_date") lease_end_date: string
    ): Promise<LeaseAPIResponse>
    {

        if (!ObjectId.isValid(lease_id) || !ObjectId.isValid(lease_document_id)) {
            return {
                success: false,
                error: "Invalid lease id."
            }
        }

        let lease_: DocumentType<Lease> = await LeaseModel.findById(lease_id) as DocumentType<Lease>;
        if (!lease_) {
            return {
                success: false,
                error: "No lease found with the given id."
            }
        }

        if (lease_.active == true) {
            return {
                success: false,
                error: "Cannot reactive an already activated elase."
            }
        }

        // activate the lease
        lease_.active = true;
        lease_.price_per_month = price_per_month;
        lease_.lease_availability_start_date = lease_start_date;
        lease_.lease_availability_end_date = lease_end_date;
        lease_.lease_document_id = lease_document_id;

        lease_.save ();

        return {
            success: true,
            data: lease_
        }
    }

    /**
     * @desc Determine whether or not the student can add a review to the
     * property with the given id.
     * 
     * @param student_id The id of the student
     * @param property_id The id of the property
     * 
     * If they can add a review, within the data, set the digit for the api response as:
     *  1 -> if they have an existing review for this property
     *  2 -> if they do not have a review on record for this property
     */
    @Query(returns => DigitAPIResponse)
    async canAddReview(
        @Arg("student_id") student_id: string,
        @Arg("property_id") property_id: string
    ): Promise<DigitAPIResponse>
    {

        if (!ObjectId.isValid(student_id) || !ObjectId(property_id)) {
            return { success: false, error: "Invalid id" }
        }

        // find the ownership document for this property
        let ownerships: DocumentType<Ownership>[]  = await OwnershipModel.find({
            property_id,
            status: 'confirmed'
        }) as DocumentType<Ownership>[];

        if (ownerships == undefined) {
            return { success: false, error: "No ownership found for the property" }
        }
        else if (ownerships.length > 1) {
            return { success: false, error: "More than one ownership active for this property" }
        }

        let ownership: DocumentType<Ownership> = ownerships[0];
        
        // Find the leases for this ownership
        let leases: DocumentType<Lease>[] = await LeaseModel.find({
            ownership_id: ownership._id
        }) as DocumentType<Lease>[];

        // go through all of the lease histories for each lease. If there is a lease history for the student_id
        // provided, then the student can add a review.
        for (let i = 0; i < leases.length; ++i) {
            if (leases[i].lease_history == undefined) continue;
            for (let j = 0; j < leases[i].lease_history.length; ++j) {
                let history_: LeaseHistory = leases[i].lease_history[j];
                if (history_.student_id == student_id) {

                    // this lease history is for the student, therefore they can write a review
                    if (history_.review_of_landlord != undefined
                    || history_.review_of_property != undefined) {
                        return { success: true, data: { value: 1 } }   
                    }
                    else return { success: true, data: { value: 2 } }
                }
            }
        }

        // no lease history found for the student and the property in question
        return { success: false }

    }

    /**
     * @desc TEMPORARY RESOLVER: This resolver is only meant to test the
     * review system, which only allows students who have previously leased
     * a property to add a review.
     * @param student_id 
     * @param start_date 
     * @param end_date 
     */
    @Mutation(returns => LeaseAPIResponse)
    async addLeaseHistory (
        @Arg("lease_id") lease_id: string,
        @Arg("student_id") student_id: string,
        @Arg("start_date") start_date: string,
        @Arg("end_date") end_date: string     
    ): Promise<LeaseAPIResponse>
    {

        if (!ObjectId.isValid(lease_id) || !ObjectId.isValid(student_id)) {
            return {
                success: false,
                error: "Id provided is invalid"
            }
        }

        // find the lease
        let lease: DocumentType<Lease> = await LeaseModel.findById(lease_id) as DocumentType<Lease>

        // ensure that the lease exists
        if (lease == undefined) {
            return {
                success: false,
                error : `Lease with id ${lease_id} does not exist`
            }
        }

        // check if the student exists
        if ( (await StudentModel.findById(student_id) as DocumentType<Student>) == undefined ) {
            return {
                success: false,
                error: `Student with id ${student_id} does not exist`
            }
        }

        // create the new lease history 
        let new_history: LeaseHistory = new LeaseHistory();
        new_history.price = 0;
        new_history.student_id = student_id;
        new_history.start_date = start_date;
        new_history.end_date = end_date;

        if (lease.lease_history == undefined) {
            lease.lease_history = [];
        }

        lease.lease_history.push(new_history);

        // save the lease
        lease.save();

        return {
            success: true,
            data: lease
        };

    }

    /**
     * Accept or decline the student's interest in the lease
     * @param action Whether or not to accept/decline
     * @param student_id The id of the student to accept or decline
     * @param lease_id The id of the lease to update the student interest of
     */
    @Mutation(returns => LeaseAPIResponse)
    async acceptOrDeclineStudentInterest (
        @Arg("action") action: "accept" | "decline",
        @Arg("student_id") student_id: string,
        @Arg("lease_id") lease_id: string
    ): Promise<LeaseAPIResponse> 
    {

        if (!ObjectId.isValid(student_id) || !ObjectId.isValid(lease_id)) {
            return {
                success: false,
                error: "Invalid id"
            }
        }

        // get the elase
        let lease: DocumentType<Lease> = await LeaseModel.findById(lease_id) as DocumentType<Lease>;
        if (!lease) {
            return {
                success: false,
                error: "Lease not found"
            }
        }

        // find the index of the student interest for the specified student_id
        let interest_id = -1;
        for (let i = 0; i < lease.student_interests.length; ++i) {
            if (lease.student_interests[i].student_id.toString() == student_id.toString()) {
                interest_id = i;
                break;
            }
        }

        if (interest_id == -1) {
            return {
                success: false,
                error: "No student interest found for this student"
            }
        }

        // update the student interest
        if (action == 'accept') {
            lease.student_interests[interest_id].accepted = true;
        }
        else if (action == 'decline') {
            lease.student_interests[interest_id].accepted = false;
        }

        // send the notification
        OwnershipModel.findById(lease.ownership_id, (err: any, ownership: DocumentType<Ownership>) => {
            if (!err && ownership) {
                LeaseModel.find({
                    ownership_id: ownership._id
                }, (err: any, leases: DocumentType<Lease>[]) => {
    
                    if (!err) {
                        // get the room number
                        let room_no = -1;
                        for (let i = 0; i < leases.length; ++i) {
                            if (leases[i]._id.toString() == lease._id.toString()) {
                                room_no = i + 1;
                                break;
                            }
                        }
    
                        PropertyModel.findById(ownership.property_id, (err: any, property: DocumentType<Property>) => {
        
                            if (!err && property) {
                                LandlordModel.findById(ownership.landlord_id, (err: any, landlord: DocumentType<Landlord>) => {
                                    if (!err && landlord) {
                                        
                                        if (action == 'accept') {
                                            NotificationsAPI.getSingleton().addStudentNotificationInformation({
                                                subject: `Lease Request Approved`, 
                                                body: `${landlord.first_name} ${landlord.last_name} has approved your request to view the lease information for ${getAddress(property)}, Room ${room_no}. View the lease and accept to take the lease, or decline to reject the lease.`,
                                                action: {
                                                    action_text: `View Lease`,
                                                    action_url: `/student/lease/${lease._id}`
                                                },
                                                student_id
                                            });
                                        }
                                        else if (action == 'decline') { 
                                            NotificationsAPI.getSingleton().addStudentNotificationInformation({
                                                subject: `Lease Request Declined`, 
                                                body: `${landlord.first_name} ${landlord.last_name} has declined your request to view the lease information for ${getAddress(property)}, Room ${room_no}. There are plenty more in the sea!`,
                                                student_id
                                            });
                                        }
                
                                    }
                                })
                            }
        
                        })
                        
                    }
    
                });
            }
        }) // end save notification
        
        // update the lease
        lease.save();
        return {
            success: true,
            data: lease
        }
    }

    /**
     * expressInterest
     * @desc A student expresses interest in a lease. They can
     * express interest in as many leases as long as they do not
     * conflict with one they are currently leasing out
     * (if it's on record)
     * @param student_id The student who is expressing interest
     * @param lease_id The lease they are expressing interest in
     */
    @Mutation(returns => LeaseAPIResponse)
    async expressInterest (
        @Arg("student_id") student_id: string,
        @Arg("lease_id") lease_id: string
    ): Promise<LeaseAPIResponse>
    {

        if (!ObjectId.isValid(student_id) || !ObjectId.isValid(lease_id)) {
            return {
                success: false,
                error: "Invalid ids"
            }
        }


        // get the student and the lease
        let lease_: DocumentType<Lease> = await LeaseModel.findById(lease_id) as DocumentType<Lease>;
        if (lease_ == undefined) {
            return {
                success: false,
                error: "No lease found"
            }
        }
        // if the lease is not active, the student cannot
        // express interest (since it is technically off the
        // market)
        if (!lease_.active) {
            return {
                success: false,
                error: "Inactive lease"
            }
        }

        let student_: DocumentType<Student> = await StudentModel.findById(student_id) as DocumentType<Student>;
        if (student_ == undefined) {
            return {
                success: false,
                error: "No student found"
            }
        }

        // we want to find all leases such that it contains a lease history with this student.
        // this is so that we can make sure that the student is not expressing interest for a lease
        // in a time frame that intersects with their active lease.
        let student_leases: DocumentType<Lease>[] = await LeaseModel.find({
            lease_history: {
                "$elemMatch": {
                    student_id: { "$eq": student_id }
                }
            }
        }) as DocumentType<Lease>[];

        let lease_avail: [Date, Date] = [
            new Date(lease_.lease_availability_start_date ? lease_.lease_availability_start_date : ""), 
            new Date(lease_.lease_availability_end_date ? lease_.lease_availability_end_date : "")
        ];

        /**
         * Filter out the leases that have no LeaseHistory such that the lease
         * history is for the student and the time frame is out of range of the current
         * lease they are experssing interet for.
         */
        let overlapping_leases: DocumentType<Lease>[] = student_leases.filter((lease: Lease) => {

            // find how many lease histories with overlapping time
            // for this student.
            return lease.lease_history.filter((history: LeaseHistory) => {
                // ignore the lease history entries that are not for this student
                if (history.student_id != student_id) return false;
                // ignore the history entries that do not have overlapping
                // dates
                let prev_avail: [Date, Date] = [
                    new Date(history.start_date),
                    new Date(history.end_date)
                ];

                // leave the ones that DO overlap
                return !(prev_avail[0] < lease_avail[0] && prev_avail[1] < lease_avail[0]
                    && prev_avail[0] < lease_avail[1] && prev_avail[1] < lease_avail[1]);
            }).length > 0;
        }); // end overlapping_leases

        if (overlapping_leases.length != 0) {
            // they cannot lease this property because it overlaps with one that is
            // already in our records for this student
            return {
                success: false,
                error: "Overlapping"
            }
        }

        // Now that they have expressed interest, we want to update the lease to have
        // their interest document stored for this lease.

        // Do not add their interest information if it is already stored for this property
        if (lease_.student_interests.filter((interest: StudentInterest) => 
            interest.student_id == student_id
        ).length > 0) {
            return {
                success: false,
                error: "Already expressed interest"
            }
        }

        // Send email to the landlord that someone is interested in their lease
        OwnershipModel.findById(lease_.ownership_id, (err: any, ownership: DocumentType<Ownership>) => {
            if (err || !ownership) {
                // Email could not be sent bc ownership not found ...
                console.log(`sendgrid -> cound not find ownership`);
            }
            else {
                PropertyModel.findById(ownership.property_id, (err: any, property: DocumentType<Property>) => {
                    if (!err && property) {
                        
                        LandlordModel.findById(ownership.landlord_id, (err_: any, landlord: DocumentType<Landlord>) => {
                            if (err_ || !landlord) {
                                // no landlord found ...
                                console.log(`send grid => could not find landlord`);
                            }
                            else {
                                let addrTxt = `${property.address_line}, `;
                                if (property.address_line_2) {
                                    addrTxt += `${property.address_line_2}, `;
                                }
                                addrTxt += `${property.city} ${property.state}, ${property.zip}`;

                                SendGrid.sendMail({
                                    to: landlord.email,
                                    email_template_id: SendGridTemplate.STUDENT_INTEREST_IN_LEASE,
                                    template_params: {
                                        first_name: landlord.first_name,
                                        last_name: landlord.last_name,
                                        property_addr_txt: addrTxt,
                                        frontend_url: frontendPath(),
                                        property_id: property._id,
                                        lease_id: lease_._id,
                                    }
                                });
                            }
                        })
                    }
                    else {
                        console.log(`send grid => could not find property`);
                    }
                });
            }
        }) // End of SendGrid block

        // add and save the interest to the lease.
        lease_.student_interests.push({
            student_id,
            date: new Date().toISOString()
        });
        lease_.save ();

        return {
            success: true,
            data: lease_
        }

    }

    @Mutation(returns => LeaseAPIResponse)
    async addReviewForLease
    (
        @Arg("lease_id") lease_id: string,
        @Arg("student_id") student_id: string,
        @Arg("property_review") property_review: string,
        @Arg("property_rating") property_rating: number,
        @Arg("landlord_review") landlord_review: string,
        @Arg("landlord_rating") landlord_rating: number,
        @Arg("property_images", returns => [String]) property_images: string[]
    ): Promise<LeaseAPIResponse>
    {

        // Find the most recent leaseHistory for this student and update
        // the review for that entry.

        // If there is no lease history for this student, no review can be
        // written.

        if (!ObjectId.isValid(lease_id) || !ObjectId.isValid(student_id)) {
            return { success: false, error: "Invalid ids" };
        }

        let lease_: DocumentType<Lease> = await LeaseModel.findById(lease_id) as DocumentType<Lease>;
        if (!lease_) {
            return { success: false, error: "No lease with that id" }
        };

        let history_found: boolean = false;
        if (lease_.lease_history != undefined) {

            let history_index = -1;
            for (let i = 0; i < lease_.lease_history.length; ++i) {

                if (lease_.lease_history[i].student_id == student_id) {

                    if (history_index == -1) history_index = i;
                    else {
                        let prev: LeaseHistory = lease_.lease_history[history_index];
                        let curr: LeaseHistory = lease_.lease_history[i];

                        let prev_date: Date = new Date(prev.end_date);
                        let curr_date: Date = new Date(curr.end_date);

                        if (curr_date > prev_date) {
                            history_index = i;
                        }
                    }
                    history_found = true;
                }
            }
            if (history_index != -1) {

                let i = history_index;
                // update the reviews
                if (lease_.lease_history[i].review_of_property == undefined) {
                    lease_.lease_history[i].review_of_property = new ReviewAndResponse();
                    lease_.lease_history[i].review_of_property!.rating = property_rating;
                    lease_.lease_history[i].review_of_property!.review = property_review;
                }
                else if (lease_.lease_history[i].review_of_property!.response == undefined) {
                    lease_.lease_history[i].review_of_property!.rating = property_rating;
                    lease_.lease_history[i].review_of_property!.review = property_review;
                }

                if (lease_.lease_history[i].review_of_landlord == undefined) {
                    lease_.lease_history[i].review_of_landlord = new ReviewAndResponse();
                    lease_.lease_history[i].review_of_landlord!.rating = landlord_rating;
                    lease_.lease_history[i].review_of_landlord!.review = landlord_review;
                }
                else if (lease_.lease_history[i].review_of_landlord!.response == undefined) {
                    lease_.lease_history[i].review_of_landlord!.rating = landlord_rating;
                    lease_.lease_history[i].review_of_landlord!.review = landlord_review;
                }

                console.log(lease_.lease_history[i]);
                console.log(lease_.lease_history[i].property_images);
                // add the images to the lease history
                if (!lease_.lease_history[i].property_images) {
                    console.log("Creating property images...");
                    lease_.lease_history[i].property_images = [];
                }

                console.log("Images to add: ", property_images.length);
                for (let k = 0; k < property_images.length; ++k) {
                    lease_.lease_history[i].property_images.push({
                        s3_key: property_images[k],
                        date_uploaded: new Date().toISOString()
                    });
                }

            }
        }

        if (!history_found) {
            return { success: false, error: "No lease history found for this student" }
        }

        lease_.save();
        return { success: true, data: lease_ }

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