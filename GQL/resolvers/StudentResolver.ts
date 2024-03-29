import { Resolver, Ctx, Mutation, Arg, Query } from 'type-graphql'
import {
  Student,
  StudentAPIResponse,
  StudentInput,
  PropertyCollectionEntriesAPIResponse,
  CollectionFetchInput,
  StudentNotificationAPIResponse,
  StudentModel,
  PropertyCollectionEntries,
  initializeStudentSearchStatus,
  studentAccessRestricted,
  SearchStatus
} from '../entities/Student'
import { Institution, InstitutionModel } from '../entities/Institution'
import { Property, PropertyModel } from '../entities/Property'
import { DocumentType } from "@typegoose/typegoose"
import mongoose from 'mongoose'
import chalk from 'chalk'
const ObjectId = mongoose.Types.ObjectId
import SendGrid, { SendGridTemplate } from '../../vendors/SendGrid'
import { generateConfirmKey } from './LandlordResolver'
import { frontendPath } from '../../config'
import bcrypt from 'bcrypt'

@Resolver()
export class StudentResolver {

  /**
   * getStudent (_id: mongoose.Types.ObjectId)
   * @desc Look for and return the student with the given id. If no student with that 
   *        id exists, return an error.
   * 
   * @param _id: mongoose.Types.ObjectId => The id of the student to retrieve
  */
  @Query(() => StudentAPIResponse, { nullable: false })
  async getStudent(@Arg("_id") _id: string): Promise<StudentAPIResponse> {
    console.log(chalk.bgBlue(`👉 getStudent(id)`))

    if (!ObjectId.isValid(_id)) {
      console.log(chalk.bgRed(`❌ Error: ${_id} is not a valid student id.`))
      return { success: false, error: "Invalid object id" }
    }
    let student_doc: DocumentType<Student> | null = await StudentModel.findById(_id)
    if (student_doc == null) {
      console.log(chalk.bgRed(`❌ Error: No student with id ${_id} exists.`))
      return { success: false, error: "No user found" }
    }
    else {
      console.log(chalk.bgGreen(`✔ Successfully found student with id ${_id}`))
      return { success: true, data: await StudentModel.findById(_id) }
    }
  }

  /**
   * getStudentSavedCollection(_id, {offset, count}: CollectionFetchInput)
   * @desc This function returns the user's collection of properties that they have saved.
   * 
   * @param _id The id of the student to get the collection for
   * @param collectionOptions
   *          offset: number => The amount to offset the fetch by
   *          count: number => The max amount of documents to return
   */
  @Query(() => PropertyCollectionEntriesAPIResponse)
  async getStudentSavedCollection(@Arg("_id") _id: string,
    @Arg("collectionOptions") { offset, count }: CollectionFetchInput): Promise<PropertyCollectionEntriesAPIResponse> {
    console.log(chalk.bgBlue(`👉 getSavedCollection(_id)`))

    let student_doc: DocumentType<Student> | null = await StudentModel.findById(_id)
    if (student_doc == null) {
      console.log(chalk.bgRed(`❌ Error: Failed to fetch collection for nonexisting user of id ${_id}`))
      return { success: false, error: "Failed to fetch collection for nonexisting user." }
    }

    console.log(`\t${chalk.cyan('offset:')} ${offset}`)
    console.log(`\t${chalk.cyan('count:')} ${count}`)
    let collection_ids = student_doc.saved_collection.slice(offset, offset + count)
    let property_promises: Promise<DocumentType<Property> | null>[] = collection_ids.map((property_id: string) => (new Promise((resolve, reject) => {

      // look for the rpoperty and resolve it if it is found
      PropertyModel.findById(property_id, (err, property_doc: DocumentType<Property>) => {

        if (err || property_doc == null) {
          resolve(null)
        }
        else {
          resolve(property_doc)
        }

      })
    })))

    let resolved_properties_: DocumentType<Property>[] = []
    for (let i = 0; i < property_promises.length; ++i) {
      let property_promise: Promise<DocumentType<Property> | null> = property_promises[i]
      let result_: DocumentType<Property> | null = await property_promise
      if (result_ != null) {
        resolved_properties_.push(result_ as DocumentType<Property>)
      }
    }

    console.log(chalk.bgGreen(`✔ Successfully retrieved ${resolved_properties_.length} properties in student ${student_doc.first_name} ${student_doc.last_name}'s collection`))
    let entries = new PropertyCollectionEntries()
    entries.collection_entries = resolved_properties_
    return {
      success: true,
      data: entries
    }
  }

  /**
   * @desc get the notifications for the student with the
   * specified student_id
   * @param student_id The student to get the notificaions for
   */
  @Query(type => StudentNotificationAPIResponse)
  async getStudentNotifications(
    @Arg("student_id") student_id: string
  ): Promise<StudentNotificationAPIResponse> {

    if (!ObjectId.isValid(student_id)) {
      return {
        success: false,
        error: "Invalid id"
      }
    }

    let student: DocumentType<Student> = await StudentModel.findById(student_id) as DocumentType<Student>;
    if (!student) {
      return {
        success: false,
        error: "Student not found"
      }
    }


    return {
      success: true,
      data: {
        notifications: student.notifications == undefined ? [] : student.notifications
      }
    }

  }

  /**
   * @desc Determine whether or not to restrict the access of a student.
   * If the student has not confirmed their institution email within 24 hours, they
   * should be restricted from using the app.
   * @param context 
   */
  @Query(type => StudentAPIResponse)
  async studentAccessShouldBeRestricted(
    @Ctx() context: any
  ): Promise<StudentAPIResponse> {

    if (!context.req.user) return { success: false };
    let student_id = context.req.user._id;

    return { success: await studentAccessRestricted(student_id) }
  }

  @Mutation(type => StudentAPIResponse)
  async saveConveniencePreferences(
    @Arg("preferences", type => [String]) preferences: string[],
    @Ctx() context: any
  ): Promise<StudentAPIResponse> {

    if (!context || !context.req || !context.req.user) {
      return { success: false, error: "User not auth" }
    }
    let student_id = context.req.user._id;
    if (!ObjectId.isValid(student_id)) {
      return { success: false, error: "Invalid user id" }
    }

    // get the student
    let student: DocumentType<Student> | null = await StudentModel.findById(student_id);
    if (student == null) {
      return { success: false, error: "Student not found" }
    }

    if (!student.convenience_tags)
      student.convenience_tags = [];

    student.convenience_tags = preferences;
    student.conveinence_setup = true;
    student.save();

    return { success: true, data: student }
  }

  @Mutation(() => StudentAPIResponse)
  async createStudent(
    @Arg("first_name") first_name: string,
    @Arg("last_name") last_name: string,
    @Arg("email") email: string,
    @Arg("password") password: string,
    @Arg("preferred_email", { nullable: true }) preferred_email: string
  ): Promise<StudentAPIResponse> {

    // check if the student exists
    let new_student: DocumentType<Student> | null = await StudentModel.findOne({
      '$or': [{ email: email }, { email: preferred_email }]
    });

    if (new_student != null) {
      return { success: false, error: "Student with this email already exists." };
    }

    // see if their email is an institution edu
    let institution: DocumentType<Institution> | null = await emailToInstitution(email);
    if (institution == null) {
      return { success: false, error: "Not an institutional email." };
    }

    new_student = new StudentModel();

    new_student.first_name = first_name;
    new_student.date_registered = new Date().toISOString();
    new_student.last_name = last_name;
    new_student.email = preferred_email == undefined ? email : preferred_email;
    new_student.edu_email = email; // save the edu email. May be the same as email.
    new_student.password = bcrypt.hashSync(password, parseInt(process.env.SALT_ROUNDS as string));

    new_student.saved_collection = [];
    new_student.user_settings = {
      recieve_email_notifications: true,
      push_subscriptions: []
    };
    new_student.auth_info = {
      institution_id: institution._id,
      auth_type: 'local'
    };
    new_student.accepted_leases = [];
    new_student.convenience_tags = [];
    new_student.conveinence_setup = false;
    initializeStudentSearchStatus(new_student);

    let confirm_key = generateConfirmKey()
    new_student.confirmation_key = generateConfirmKey();

    await new_student.save();

    // Send email confirmation to the student
    SendGrid.sendMail({
      to: email.toString(),
      email_template_id: SendGridTemplate.STUDENT_EMAIL_CONFIRMATION,
      template_params: {
        confirmation_key: confirm_key,
        frontend_url: frontendPath(),
        email: email.toString(),
        first_name: new_student.first_name.toString(),
        last_name: new_student.last_name.toString()
      }
    })

    return {
      success: true
    };
  }

  @Mutation(() => StudentAPIResponse)
  async studentEmailConfirmed(
    @Ctx() context: any
  ): Promise<StudentAPIResponse> {
    if (!context.req.user) return { success: false, error: "Not logged in" };
    let student_id = context.req.user._id;

    let student: DocumentType<Student> | null = await StudentModel.findById(student_id);
    if (student == null) return { success: false, error: "User does not exist" }

    if (student.confirmation_key == undefined) return { success: true }
    else return { success: false }

  }

  /**
   * Resend email confirmation to the currently logged in student
   * if they have not yet been confirmed.
   * @param context 
   */
  @Mutation(() => StudentAPIResponse)
  async resendStudentEmailConfirmation(
    @Ctx() context: any
  ): Promise<StudentAPIResponse> {

    if (!context.req.user) return { success: false, error: "Not logged in" };
    let student_id = context.req.user._id;

    let student: DocumentType<Student> | null = await StudentModel.findById(student_id);
    if (student == null) return { success: false, error: "User does not exist" };

    if (student.email == undefined || student.first_name == undefined || student.last_name == undefined)
      return { success: false, error: "Student info not set" }

    if (student.confirmation_key == undefined)
      return { success: false, error: "Student already confirmed" }

    SendGrid.sendMail({
      to: student.email.toString(),
      email_template_id: SendGridTemplate.STUDENT_EMAIL_CONFIRMATION,
      template_params: {
        confirmation_key: student.confirmation_key,
        frontend_url: frontendPath(),
        email: student.email.toString(),
        first_name: student.first_name.toString(),
        last_name: student.last_name.toString()
      }
    })

    return { success: true, error: student.email }
  }

  /**
   * Mark the notification with the given notification_id for the student as seen
   * @param student_id 
   * @param notification_id 
   */
  @Mutation(() => StudentNotificationAPIResponse)
  async markStudentNotificationAsSeen(
    @Arg("student_id") student_id: string,
    @Arg("notification_id") notification_id: string
  ): Promise<StudentNotificationAPIResponse> {

    if (!ObjectId.isValid(student_id) || !ObjectId.isValid(notification_id)) {
      return { success: false, error: "Invalid id" }
    }

    // find the student
    let student: DocumentType<Student> = await StudentModel.findById(student_id) as DocumentType<Student>;
    if (!student) {
      return { success: false, error: "User not found" }
    }

    // find the notification with the notification id in the student
    if (student.notifications) {
      for (let i = 0; i < student.notifications.length; ++i) {
        if (student.notifications[i]._id == notification_id) {

          // only mark it as seen if it was not previously seen
          if (student.notifications[i].date_seen == undefined) {
            student.notifications[i].date_seen = new Date().toISOString();
          }

          break;
        }
      }
    } // end if

    // save the student
    student.save();

    // return the updated student notifications
    return {
      success: true,
      data: {
        notifications: student.notifications ? student.notifications : []
      }
    }

  }

  /**
   * updateStudentSearchStatus
   * @desc Update the status for the student with the id.
   * @param id The id for the student to update the status for.
   * @param searching Specify whether the student is looking for a property or not
   * @param search_start Set the start date the student is looking for, if looking is set to true
   * @param search_end Set the end date the student is looking for, if looking is set to true
   */
  @Mutation(() => StudentAPIResponse)
  async updateStudentSearchStatus(
    @Arg("id") id: string,
    @Arg("searching") searching: boolean,
    @Arg("search_start", { nullable: true }) search_start?: string,
    @Arg("search_end", { nullable: true }) search_end?: string,
    @Arg("price_start", { nullable: true }) price_start?: number,
    @Arg("price_end", { nullable: true }) price_end?: number
  ): Promise<StudentAPIResponse> {

    let student: DocumentType<Student> = await StudentModel.findById(id) as DocumentType<Student>
    if (!student) {
      return {
        success: false,
        error: "Student with id does not exist."
      }
    }

    // add the search status, if it is not on the student object 
    if (!student.search_status) student.search_status = new SearchStatus();

    student.search_status.searching = searching;
    if (searching) {

      // check that the start date is in the future
      if (price_start == null || price_end == null || search_start == null || search_end == null) {
        return { success: false, error: "Expected null fields to not be null." };
      }
      let start = new Date(search_start);
      let end = new Date(search_end);

      if (start <= new Date()) {
        return { success: false, error: "Start date is in the past." }
      }

      if (end < start) {
        return { success: false, error: "End date occurs before the start date." }
      }

      student.search_status.search_start = search_start;
      student.search_status.search_end = search_end;
      student.search_status.price_start = price_start;
      student.search_status.price_end = price_end;
    }
    else {
      student.search_status.search_start = undefined;
      student.search_status.search_end = undefined;
      student.search_status.price_start = undefined;
      student.search_status.price_end = undefined;
    }

    // set date_updated
    student.search_status.date_updated = new Date().toISOString();
    let saved_student: DocumentType<Student> = await student.save() as DocumentType<Student>;

    return {
      success: true,
      data: saved_student
    }
  }

  /**
   * addPropertyToStudentCollection(student_id: string, property_id: string)
   * @desc Add a property with the specified property_id to the student's collection.
   * 
   * @param student_id: string => The student's id of the collection to add the property to
   * @param property_id: string => The id of the property to add to the student's collection
   */
  @Mutation(() => PropertyCollectionEntriesAPIResponse)
  async addPropertyToStudentCollection(@Arg("student_id") student_id: string,
    @Arg("property_id") property_id: string): Promise<PropertyCollectionEntriesAPIResponse> {

    console.log(chalk.bgBlue(`👉 addPropertyToStudentCollection(student_id, property_id)`))
    console.log(`\t${chalk.cyan(`student_id:`)} ${student_id}`)
    console.log(`\t${chalk.cyan(`property_id:`)} ${property_id}`)

    let property_doc: DocumentType<Property> | null = await PropertyModel.findById(property_id)
    if (property_doc == null) {
      console.log(chalk.bgRed(`❌ Error: No property found with id ${property_id}`))
      return { success: false, error: "No property found with given id" }
    }

    let student_doc: DocumentType<Student> | null = await StudentModel.findById(student_id)
    if (student_doc == null) {
      console.log(chalk.bgRed(`❌ Error: No student found with id ${student_id}`))
      return { success: false, error: "No student found with given id" }
    }

    // check if the student already has the property saved.
    let already_in_collection: boolean = false
    for (let i = 0; !already_in_collection && i < student_doc.saved_collection.length; ++i) {
      if (student_doc.saved_collection[i] == property_id) already_in_collection = true;
    }
    if (already_in_collection) {
      console.log(chalk.bgRed(`❌ Error: Student already has this property saved in their collection.`))
      return { success: false, error: `Property already saved in user's collection` }
    }

    // update their collection...
    student_doc.saved_collection.push(property_id)
    let updated_student_doc: DocumentType<Student> | null = await student_doc.save() as DocumentType<Student>

    if (!updated_student_doc) {
      console.log(chalk.bgRed(`❌ Error: Problem saving new collection for student`))
      return {
        success: false,
        error: "Internal server error"
      }
    }

    console.log(chalk.bgGreen(`✔ Successfully added property to student's collection!`))
    let new_collection_ids = updated_student_doc.saved_collection.map((_id) => {
      return {
        _id: _id
      }
    })

    return {
      success: true,
      data: {
        collection_entries: new_collection_ids
      }
    }

  }

  /**
   * removePropertyFromStudentCollection(student_id: string, property_id: string)
   * @desc Add a property with the specified property_id to the student's collection.
   * 
   * @param student_id: string => The student's id of the collection to add the property to
   * @param property_id: string => The id of the property to add to the student's collection
   */
  @Mutation(() => PropertyCollectionEntriesAPIResponse)
  async removePropertyFromStudentCollection(@Arg("student_id") student_id: string,
    @Arg("property_id") property_id: string): Promise<PropertyCollectionEntriesAPIResponse> {

    console.log(chalk.bgBlue(`👉 removePropertyFromStudentCollection(student_id, property_id)`))
    console.log(`\t${chalk.cyan(`student_id:`)} ${student_id}`)
    console.log(`\t${chalk.cyan(`property_id:`)} ${property_id}`)

    let student_doc: DocumentType<Student> | null = await StudentModel.findById(student_id)
    if (student_doc == null) {
      console.log(chalk.bgRed(`❌ Error: No student found with id ${student_id}`))
      return { success: false, error: "No student found with given id" }
    }

    // remove from collection
    student_doc.saved_collection = student_doc.saved_collection.filter(property_id_ => property_id != property_id_)
    let updated_student_doc: DocumentType<Student> | null = await student_doc.save() as DocumentType<Student>

    if (!updated_student_doc) {
      console.log(chalk.bgRed(`❌ Error: Problem saving new user collections`))
      return {
        success: false,
        error: "Internal server error"
      }
    }

    let new_collection_ids = updated_student_doc.saved_collection.map((_id) => ({ _id: _id }))
    console.log(chalk.bgGreen(`✔ Successfully removed property from student's collection!`))
    return {
      success: true,
      data: {
        collection_entries: new_collection_ids
      }
    }

  }

  /**
   * updateStudent ()
   * @desc Update the student information for the student with the provided id.
   *        If a parameter field is null, that field should be left unmodified.
   * 
   * @param _id: mongoose.Types.ObjectId => The id of the student to update
   * @param new_student
   *          first_name: string | null => The new value of the first_name for the student 
   *          last_name: string | null => The new value of the last_name for the student
   *          email: string | null => The new value of the email for the student
   */
  @Mutation(() => StudentAPIResponse)
  async updateStudent(@Arg("_id") _id: string, @Arg("new_student") { first_name, last_name, email }: StudentInput): Promise<StudentAPIResponse> {

    let student_doc: DocumentType<Student> | null = await StudentModel.findById(_id)
    if (student_doc == null) {
      console.log(chalk.bgRed(`❌ Error: Attempting to update info for nonexisting user`))
      return { success: false, error: "Invalid user id." }
    }
    else {

      let updated: boolean = false
      if (first_name) { student_doc.first_name = first_name; updated = true; }
      if (last_name) { student_doc.last_name = last_name; updated = true; }
      if (email) {
        student_doc.email = email; updated = true;

        // generate confirm key
        let confirm_key = generateConfirmKey()
        student_doc.confirmation_key = confirm_key;

        SendGrid.sendMail({
          to: email.toString(),
          email_template_id: SendGridTemplate.STUDENT_EMAIL_CONFIRMATION,
          template_params: {
            confirmation_key: confirm_key,
            frontend_url: frontendPath(),
            email: email.toString(),
            first_name: student_doc.first_name.toString(),
            last_name: student_doc.last_name.toString()
          }
        })
      }

      console.log(chalk.bgGreen(`✔ Successfully updated student with id ${_id}`))
      if (updated) {
        let updated_student: DocumentType<Student> = await student_doc.save() as DocumentType<Student>
        return { success: true, data: updated_student }
      }
      else return { success: true, data: student_doc }

    }

  }

  @Mutation(() => StudentAPIResponse)
  async confirmStudentEmail(
    @Arg("email") email: string,
    @Arg("confirm_key") confirm_key: string
  ): Promise<StudentAPIResponse> {

    console.log(chalk.bgBlue(`👉 confirmEmail()`))
    console.log(`\t${chalk.cyan(`email`)} ${email}`)

    let student: DocumentType<Student> = await StudentModel.findOne({
      email,
      confirmation_key: confirm_key
    }) as DocumentType<Student>

    if (!student) {
      console.log(chalk.bgRed(`No student found with email ${email} and confirm key:\n\t${confirm_key}`))
      return {
        success: false,
        error: `No student found`
      }
    }

    student.confirmation_key = undefined;
    let updated_student: DocumentType<Student> = await student.save() as DocumentType<Student>

    console.log(chalk.bgGreen(`✔ Successfully confirmed student's email (${email})`))
    return {
      success: true,
      data: updated_student
    }

  }

}

const emailToInstitution = async (email: string): Promise<DocumentType<Institution> | null> => {

  // find the last '@'
  let ind = email.lastIndexOf('@');
  if (ind == -1) return null;

  let suffix = email.substring(ind + 1);
  let institution: DocumentType<Institution> | null = await InstitutionModel.findOne({
    edu_suffix: suffix
  });

  // institution does not exist ...
  if (institution == null) return null;

  return institution;

}

const has = (obj_: { [key: string]: any }, prop: string) => Object.prototype.hasOwnProperty.call(obj_, prop);