import {prop, getModelForClass} from "@typegoose/typegoose"
import {Field, ObjectType, ID, InputType} from "type-graphql"
import {APIResult} from "."

@ObjectType({description: "Keys for push subscription"})
class PushSubscriptionKeys {

  @Field(type => String)
  @prop({type: String})
  p256dh: string;

  @Field(type => String)
  @prop({type: String})
  auth: string;
}

@ObjectType({description: "Push Subscription Details"})
export class PushSubscription {
  
  @Field(type => String)
  @prop({type: String})
  endpoint: string;
  
  @Field(type => PushSubscriptionKeys)
  @prop({type: PushSubscriptionKeys})
  keys: PushSubscriptionKeys;

}

@ObjectType({description: "Landlord User Settings"})
export class LandlordUserSettings {
  @Field(type => Boolean)
  @prop({type: Boolean})
  recieve_email_notifications: boolean;

  @Field(type => [PushSubscription])
  @prop({type: [PushSubscription]})
  push_subscriptions: PushSubscription[];
}
export const initializeLandlordSettings = (student: Landlord) => {
  if (student.user_settings) return;
  student.user_settings = new LandlordUserSettings();
  student.user_settings = {
    recieve_email_notifications: true,
    push_subscriptions: []
  }
}

@ObjectType({description: "Landlord model"})
export class Landlord {
  @Field(() => ID)
  _id: string;

  @Field()
  @prop()
  first_name: string;

  @Field()
  @prop()
  last_name: string;

  @Field()
  @prop()
  email: string;

  @Field({ nullable: true })
  @prop()
  phone_number: string;

  @Field(type => String, {nullable: true})
  @prop({type: String})
  password?: string;
  
  @Field(type => String, {nullable: true})
  @prop({type: String})
  type?: String;

  @Field(type => String, {nullable: true})
  @prop({type: String})
  confirmation_key?: string;

  @Field(type => Boolean, {nullable: true})
  @prop({type: Boolean})
  onboarded?: boolean;

  @Field(type => LandlordUserSettings, {nullable: true})
  @prop({type: LandlordUserSettings})
  user_settings?: LandlordUserSettings;

  @Field(type => String, {nullable: true})
  @prop({type: String})
  landlord_reset_key?: string;

  // The expiration date for any reset link given
  @Field(type => String, {nullable: true})
  @prop({type: String})
  landlord_reset_link_exp?: string;
}

@InputType()
export class LandlordInput implements Partial<Landlord> {
  @Field({nullable: true})
  _id: string;

  @Field({nullable: true})
  first_name: string;
  
  @Field({nullable: true})
  last_name: string;
  
  @Field({nullable: true})
  email: string;
  
  @Field({nullable: true})
  phone_number: string;
  
  @Field({nullable: true})
  password: string;
}

@ObjectType()
export class LandlordAPIResponse extends APIResult(Landlord) {}

export const LandlordModel = getModelForClass(Landlord)