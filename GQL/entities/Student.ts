import { prop, getModelForClass } from "@typegoose/typegoose"
import { Field, ObjectType, InputType, ID, Int } from "type-graphql";
import {PushSubscription} from './Landlord'
import {APIResult} from "."
import {Property} from './Property'
import {ObjectId} from 'mongodb'
import {DocumentType} from "@typegoose/typegoose"

/**
 * SearchStatus
 * @desc describes the status of whether a student
 * is looking for a property or not. And if so, for
 * which time period.
 */
@ObjectType({description: "Status of student search"})
export class SearchStatus {

  // @prop -> date_updated: The ISO string of the last date the status was updated
  @Field(type => String)
  @prop({type: String})
  date_updated: string;

  // @prop -> searching: If true, the student is searching for a propety
  @Field(type => Boolean)
  @prop({type: Boolean})
  searching: boolean;

  // prop -> search_start: The start date the student is searching for, if searching is true
  @Field(type => String, {nullable: true})
  @prop({type: String})
  search_start?: string;

  // prop -> search_end: The end date the student is searching for, if searching is true
  @Field(type => String, {nullable: true})
  @prop({type: String})
  search_end?: string;

  // prop -> price_start: The start price for lease
  @Field(type => Number, {nullable: true})
  @prop({type: Number})
  price_start?: number;

  // prop -> price_end: The end price for lease
  @Field(type => Number, {nullable: true})
  @prop({type: Number})
  price_end?: number;
}
/** 
 * Modify the student object to provide default values
 * for the student's search status properties.
*/
export const initializeStudentSearchStatus = (student: Student) => {
  student.search_status = new SearchStatus();
  student.search_status.date_updated = new Date(0).toISOString();
  student.search_status.searching = false;
}

/**
 * StudentUserSettings
 * @desc describes the settings object for a student
 */
@ObjectType({description: "Student User Settinhs"})
export class StudentUserSettings {
  @Field(type => Boolean)
  @prop({type: Boolean})
  recieve_email_notifications: boolean;

  @Field(type => [PushSubscription])
  @prop({type: [PushSubscription]})
  push_subscriptions: PushSubscription[];
}

export const initializeStudentSettings = (student: Student) => {
  if (student.user_settings) return;
  student.user_settings = new StudentUserSettings();
  student.user_settings = {
    recieve_email_notifications: true,
    push_subscriptions: []
  }
}

/**
 * CasAuthInfo
 * @desc describes the CAS authentication information
 * for a student logging in through CAS auth 3.0 system.
 */
@ObjectType({description: "Cas Auth Information"})
class CasAuthInfo {
  @Field(type => String, { nullable: true })
  @prop({type: String})
  cas_id?: String;
  
  @Field(type => String, { nullable: true })
  @prop({type: String})
  institution_id: String;

  // discern whether the authentication is through the
  // cas login system or the local authentication.
  @Field(type => String, { nullable: true })
  @prop({type: String})
  auth_type: 'cas' | 'local';
}

@ObjectType({description: "An array of collection entries"}) 
export class PropertyCollectionEntries{  
  @Field(type => [Property])
  @prop({ type: [Property] })
  collection_entries: Partial<Property>[];
}

@ObjectType()
export class NotificationAction {

  @Field(type => String)
  @prop({type: String})
  action_text: string;

  @Field(type => String)
  @prop({type: String})
  action_url: string;
}

@ObjectType()
export class StudentNotification {

  @Field(type => String)
  @prop({type: String})
  _id: string;

  @Field(type => String)
  @prop({type: String})
  date_created: string;

  // The date that the notification was seen.
  // This is only set if the student has seen the notification
  @Field(type => String, {nullable: true})
  @prop({type: String})
  date_seen?: string;

  @Field(type => String)
  @prop({type: String})
  subject: string;

  @Field(type => String)
  @prop({type: String})
  body: string;

  @Field(type => NotificationAction, {nullable: true})
  @prop({type: NotificationAction})
  action?: NotificationAction;

}

@ObjectType()
export class StudentNotificationCollection {

  @Field(type => [StudentNotification])
  @prop({type: [StudentNotification]})
  notifications: StudentNotification[];
}

@ObjectType()
export class StudentNotificationAPIResponse extends APIResult(StudentNotificationCollection) {}

@ObjectType()
export class AcceptedLeaseInfo {

  // The id of the lease document that was accepted
  // by the student
  @Field(type => String)
  @prop({type: String})
  lease_id: string;

  // The id of the lease history instance that the student has
  // accepted.
  @Field(type => String)
  @prop({type: String})
  history_id: string;
}

/**
 * Student
 * @desc The student object that describes a student
 * user.
 */
@ObjectType({description: "Student model"})
export class Student {
  @Field(() => ID)
  _id: string;

  @Field()
  @prop()
  first_name: String;

  @Field(type => String, {nullable: true})
  @prop({type: String})
  date_registered?: string;

  @Field()
  @prop()
  last_name: String;
  
  @Field(type => String, {nullable: true})
  @prop()
  email?: String;

  @Field(type => String, {nullable: true})
  @prop({type: String})
  edu_email?: string;

  @Field(type => String, {nullable: true})
  @prop({type: String})
  password?: string;
  
  @Field(type => String, {nullable: true})
  @prop()
  phone_number?: String;

  @Field(type => CasAuthInfo, { nullable: true })
  @prop({ type: CasAuthInfo })
  auth_info: CasAuthInfo;

  @Field(type => [String], {nullable: true})
  @prop({type: [String]})
  saved_collection: string[];

  @Field(type => String, {nullable: true})
  @prop({type: String})
  type?: String;

  @Field(type => [String], {nullable: true})
  @prop({type: String})
  elevated_privileges?: string[]

  @Field(type => [String], {nullable: true})
  @prop({type: String})
  confirmation_key?: string;

  @Field(type => StudentUserSettings, {nullable: true})
  @prop({type: StudentUserSettings})
  user_settings?: StudentUserSettings;

  @Field(type => SearchStatus, {nullable: true})
  @prop({type: SearchStatus})
  search_status?: SearchStatus;

  @Field(type => [StudentNotification], {nullable: true})
  @prop({type: [StudentNotification]})
  notifications?: StudentNotification[];

  // The array of leases the student has currently
  // accepted (either current, or in the future)
  @Field(type => [AcceptedLeaseInfo], {nullable: true})
  @prop({type: [AcceptedLeaseInfo]})
  accepted_leases: AcceptedLeaseInfo[];

  // The list of tags that a student sets as
  // conveniecne identifiers for property
  // personalization
  @Field(type => [String], {nullable: true})
  @prop({type: [String]})
  convenience_tags?: string[];

  @Field(type => Boolean, {nullable: true})
  @prop({type: Boolean})
  conveinence_setup: boolean;
}

@InputType()
export class StudentInput implements Partial<Student> {

  @Field({ nullable: true })
  _id: string;

  @Field({ nullable: true })
  first_name: String;

  @Field({ nullable: true })
  last_name: String;
  
  @Field({ nullable: true })
  email: String;
}

@InputType()
export class CollectionFetchInput {

  @Field(type => Int)
  @prop({type: Int})
  offset: number;

  @Field(type => Int)
  @prop({type: Int})
  count: number;
}

@ObjectType()
export class StudentAPIResponse extends APIResult(Student) {}
@ObjectType()
export class PropertyCollectionEntriesAPIResponse extends APIResult(PropertyCollectionEntries) {}

export const StudentModel = getModelForClass(Student)

///////////////////
@ObjectType()
class NumberValue {

  @Field(type => Number)
  @prop({type: Number})
  value: number;
}

@ObjectType()
export class NumberAPIResponse extends APIResult(NumberValue) {}

// functions
export const studentAccessRestricted = async (student_id: string): Promise<boolean> => {

  let student: DocumentType<Student> | null = await StudentModel.findById(student_id);
  
  // student cannot be found ...
  if (student == null) return true;

  // if student already confirmed, they should not have access restricted
  if (student.confirmation_key == undefined) return false;

  // check the registered date. If it has been 24 hours since
  // the registration date and they have not yet confirmed, restrict
  // the access.
  if (student.date_registered == undefined) return true;
  let date_ = new Date(student.date_registered);
  date_.setDate(date_.getDate() + 1);

  return date_ < new Date();
}