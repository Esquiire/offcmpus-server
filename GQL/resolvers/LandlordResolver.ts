import {Resolver, Mutation, Arg, Query} from 'type-graphql'
import {Landlord, LandlordAPIResponse, LandlordInput, LandlordModel} from '../entities/Landlord'
import {DocumentType} from "@typegoose/typegoose"
import mongoose from 'mongoose'
import chalk from 'chalk'
import bcrypt from 'bcrypt'
const ObjectId = mongoose.Types.ObjectId
import SendGrid, {SendGridTemplate} from '../../vendors/SendGrid'
import {frontendPath} from '../../config'

@Resolver()
export class LandlordResolver {

  /**
   * getLandlord(_id: mongoose.Types.ObjectId)
   * @desc Look for the landlord with the given id. If no landlord exists
   *        with that id, then the error field is provided and success is 
   *        set to false.
   * 
   * @param _id: mongoose.Types.ObjectId => The id of the landlord to fetch 
   */
  @Query(() => LandlordAPIResponse)
  async getLandlord (@Arg("_id") _id: string): Promise<LandlordAPIResponse> {
    console.log(chalk.bgBlue(`👉 getLandlord(id)`));

    if (!ObjectId.isValid(_id)) {
      console.log(chalk.bgRed(`❌ Error: ${_id} is not a valid landlord id.`))
      return {success: false, error: "Invalid landlord id"}
    }
    let landlord_doc: DocumentType<Landlord> | null = await LandlordModel.findById(_id)
    if (landlord_doc == null) {
      console.log(chalk.bgRed(`❌ Error: No landlord with id ${_id} exists.`))
      return {success: false, error: "No landlord found"}
    }
    else {
      console.log(chalk.bgGreen(`✔ Successfully found landlord with id ${_id}`))
      return {success: true, data: landlord_doc}
    }
  }

  @Query(() => LandlordAPIResponse)
  async resendEamilConfirmation(@Arg("landlord_id") landlord_id: string): Promise<LandlordAPIResponse>
  {
    console.log(chalk.bgBlue(`👉 resendEmail()`))
    if (!ObjectId.isValid(landlord_id)) {
      console.log(chalk.bgRed(`❌ Error: landlord_id is not a valid object id`))
      return {
        success: false,
        error: `Invalid landlord_id provided`
      }
    }

    let landlord_: DocumentType<Landlord> = await LandlordModel.findById(landlord_id) as DocumentType<Landlord>
    if (!landlord_) {
      console.log(chalk.bgRed(`❌ Error: No landlord found with id ${landlord_id}`))
      return {
        success: false,
        error: `landlord does nto exist`
      }
    }

    if (landlord_.confirmation_key) {
      SendGrid.sendMail({
        to: landlord_.email,
        email_template_id: SendGridTemplate.LANDLORD_EMAIL_CONFIRMATION,
        template_params: {
          confirmation_key: landlord_.confirmation_key,
          frontend_url: frontendPath(),
          email: landlord_.email,
          first_name: landlord_.first_name,
          last_name: landlord_.last_name
        }
      })
    }
    else {
      console.log(chalk.yellow(`\tLandlord (${landlord_.email}) has already confirmed their email`))
    }

    return {
      success: true,
      data: landlord_
    }
  }

  @Query(returns => LandlordAPIResponse)
  async checkPasswordResetKey(
    @Arg("reset_key") reset_key: string,
    @Arg("email") email: string
  ): Promise<LandlordAPIResponse>
  {

    // see if there is a landlord with the reset key and email on their document
    let landlord: DocumentType<Landlord> = await LandlordModel.findOne({
      landlord_reset_key: reset_key,
      email: email
    }) as DocumentType<Landlord>;

    // no expireation date attached along with the reset key
    if (landlord.landlord_reset_link_exp == undefined) return { success: false }

    // check that the reset link has not expired
    let exp: Date = new Date(landlord.landlord_reset_key as string);
    if (new Date() > exp) return { success: false } // <- link has expired

    if (!landlord) return { success: false }
    return { success: true }

  }

  /**
   * createLandlord()
   * @desc Create a landlord object with the given first_name, last_name, email, and
   * password (the minimum required for a landlord account)
   * 
   * @param new_landlord
   *          first_name: string | null => the first name of the new landlord
   *          last_name: string | null => the last name of the new landlord
   *          email: string | null => the email of the new landlord
   *          password: string | null => the password of the new landlord
   */
  @Mutation(() => LandlordAPIResponse)
  async createLandlord(@Arg("new_landlord"){first_name, last_name, email, password}: LandlordInput) {
    console.log(chalk.bgBlue(`👉 createLandlord()`))

    if (!first_name || !last_name || !email || !password) {
      console.log(chalk.bgRed(`❌ Error: Insufficient fields`))
      return {success: false, error: "Insufficient fields."}
    }

    let landlord: DocumentType<Landlord> | null = await LandlordModel.findOne({ email })
    if (landlord != null) {
      console.log(chalk.bgRed(`❌ Error: User already exists with email ${email}`))
      return {success: false, error: "Landlord already exists"}
    }
    else {

      let confirm_key: string =  generateConfirmKey ()
      let hashed_password: string = bcrypt.hashSync(password, parseInt(process.env.SALT_ROUNDS as string))
      let new_landlord = new LandlordModel({
        first_name,
        last_name,
        email,
        password: hashed_password,
        confirmation_key: confirm_key,
        onboarded: false,
        user_settings: {
          recieve_email_notifications: true,
          push_subscriptions: []
        }
      })

      // Email
      SendGrid.sendMail({
        to: email,
        email_template_id: SendGridTemplate.LANDLORD_EMAIL_CONFIRMATION,
        template_params: {
          confirmation_key: confirm_key,
          frontend_url: frontendPath(),
          email: email,
          first_name: first_name,
          last_name: last_name
        }
      })

      let saved_landlord: DocumentType<Landlord> = await new_landlord.save() as DocumentType<Landlord>
      console.log(console.log(chalk.bgGreen(`✔ Successfully created a new landlord (${first_name} ${last_name})`)))
      return { success: true, data: saved_landlord }
    }

  }

  @Mutation(() => LandlordAPIResponse)
  async updatePhoneNumber(
    @Arg("landlord_id") landlord_id: string,
    @Arg("phone_number") phone_number: string
  ): Promise<LandlordAPIResponse>
  {

    console.log(chalk.bgBlue(`👉 updatePhoneNumber()`))
    if (!ObjectId.isValid(landlord_id)) {
      console.log(chalk.bgRed(`❌ Error: Landlord id ${landlord_id} is not a valid object id`))
      return {
        success: false,
        error: "Invalid landlord id"
      }
    }
    let landlord_: DocumentType<Landlord> = await LandlordModel.findById(landlord_id) as DocumentType<Landlord>
    landlord_.phone_number = phone_number

    let updated_landlord: DocumentType<Landlord> = await landlord_.save() as DocumentType<Landlord>
    
    console.log(chalk.bgGreen(`✔ Successfully updated phone number!`))
    return {
      success: true,
      data: updated_landlord
    }

  }

  /**
   * @desc Send the landlord a password reset link so they can
   * reset their password information.
   * @param email The email of the landlord's account
   */
  @Mutation(() => LandlordAPIResponse)
  async sendPasswordReset(
    @Arg("email") email: string
  ): Promise<LandlordAPIResponse>
  {
    
    // find the landlord with this email
    let landlord: DocumentType<Landlord> = await LandlordModel.findOne({email: email}) as DocumentType<Landlord>;
    if (!landlord) return {success: false, error: "No landlord found"}

    // add password reset key
    let key_: string = generateConfirmKey();
    landlord.landlord_reset_key = key_;
    // set the expiration-date for 24 hours
    {
      let exp: Date = new Date();
      exp.setDate(exp.getDate() + 1);
      landlord.landlord_reset_link_exp = exp.toString();
    }
    landlord.save();

    SendGrid.sendMail({
      to: landlord.email,
      email_template_id: SendGridTemplate.LANDLORD_PASSWORD_RESET,
      template_params: { 
        first_name: landlord.first_name,
        last_name: landlord.last_name,
        frontend_url: frontendPath(),
        reset_key: key_,
        email_: landlord.email
      }
    })

    return { success: true }

  }

  /**
   * @desc Reset the password for the account with the given email and
   * reset_key, with new_password.
   * @param email 
   * @param reset_key 
   * @param new_pasword 
   */
  @Mutation(() => LandlordAPIResponse)
  async resetPassword(
    @Arg("email") email: string,
    @Arg("reset_key") reset_key: string,
    @Arg("new_password") new_password: string
  ): Promise<LandlordAPIResponse>
  {

    // find the landlord with the email and reset key
    let landlord: DocumentType<Landlord> = await LandlordModel.findOne({email: email, landlord_reset_key: reset_key}) as DocumentType<Landlord>;
    if (!landlord) return { success: false, error: "No landlord found" }

    // check if the link has expired
    if (!landlord.landlord_reset_link_exp) return { success: false, error: "No link expiration date found" }
    let exp: Date = new Date(landlord.landlord_reset_key as string);
    
    if (new Date() > exp) {
      landlord.landlord_reset_key = undefined;
      landlord.landlord_reset_link_exp = undefined;
      landlord.save();

      return { success: false, error: "Link has expired" }
    }

    // if here, the landlord's link is still active and they can successfully change their password
    let hashed_password: string = bcrypt.hashSync(new_password, parseInt(process.env.SALT_ROUNDS as string))
    landlord.password = hashed_password;
    landlord.save();
    return { success: true }

  }

  @Mutation(() => LandlordAPIResponse)
  async confirmLandlordEmail(
    @Arg("email") email: string,
    @Arg("confirm_key") confirm_key: string
  ): Promise<LandlordAPIResponse> 
  {
    console.log(chalk.bgBlue(`👉 confirmEmail()`))
    console.log(`\t${chalk.cyan(`email`)} ${email}`)

    let landlord: DocumentType<Landlord> = await LandlordModel.findOne({
      email: email,
      confirmation_key: confirm_key
    }) as DocumentType<Landlord>

    if (!landlord) {
      console.log(chalk.bgRed(`❌ Error: No landlord found`))
      return {
        success: false,
        error: `No landlord found`
      }
    }

    landlord.confirmation_key = undefined;
    let updated_landlord = await landlord.save() as DocumentType<Landlord>

    console.log(chalk.bgGreen(`✔ Successfully confirmed email of landlord (${email})`))
    return {
      success: true,
      data: landlord
    }
  }

  @Mutation(() => LandlordAPIResponse)
  async setLandlordOnboarded(
    @Arg("landlord_id") landlord_id: string
  ): Promise<LandlordAPIResponse> 
  {

    if (!ObjectId.isValid(landlord_id)) {
      return {
        success: false,
        error: `Invalid landlord id`
      }
    }

    let landlord_: DocumentType<Landlord> = await LandlordModel.findById(landlord_id) as DocumentType<Landlord>;
    if (!landlord_) {
      return {
        success: false,
        error: `No landlord found`
      }
    }

    landlord_.onboarded = undefined;
    let saved_landlord: DocumentType<Landlord> = await landlord_.save() as DocumentType<Landlord>
    return {
      success: true,
      data: saved_landlord
    }

  }
}

export const generateConfirmKey = (): string => {
  let capitals = [65, 91];
  let lowercases = [97, 123];

  let key_ = ""
  for (let i = 0; i < 120; ++i) {
    let r_ = Math.random();
    if (r_ < 0.33) {
      key_ += String.fromCharCode( Math.floor(( (capitals[1] - capitals[0]) * Math.random() ) + capitals[0] ) );
    }
    else if (r_ < 0.66) {
      key_ += String.fromCharCode( Math.floor(( (lowercases[1] - lowercases[0]) * Math.random() ) + lowercases[0] ) );
    }
    else key_ += Math.floor(Math.random() * 10).toString()
  }
  return key_
}