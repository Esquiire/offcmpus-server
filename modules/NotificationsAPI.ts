import webpush from 'web-push'
import {Landlord, PushSubscription, initializeLandlordSettings} from '../GQL/entities/Landlord'
import {Student, StudentModel, StudentNotification, initializeStudentSettings} from '../GQL/entities/Student'
import {DocumentType} from '@typegoose/typegoose'
import SendGrid, {SendGridTemplate} from '../vendors/SendGrid'
import mongoose from 'mongoose'

const ObjectId = mongoose.Types.ObjectId

interface StudentNotif {
    subject: string
    body: string
    action?: {
        action_text: string
        action_url: string
    }
    student_id: string
}

/**
 * NotificationsAPI
 * =============================
 * NotificationsAPI handles the sending of notifications
 * through Push Notifications & Email.
 */
export class NotificationsAPI {

    static _instance: NotificationsAPI | null = null;
    static getSingleton (): NotificationsAPI {
        if (this._instance == null) {
            this._instance = new NotificationsAPI();
        }
        return this._instance;
    }

    // Class Methods

    /**
     * addPushSubscription ()
     * @param user_: Student | Landlord -> The user to add the subscription to
     * @param subscription_ -> The subscription information to store
     */
    async addPushSubscription (
        user_: DocumentType<Student> | DocumentType<Landlord>,
        subscription_: webpush.PushSubscription
    ): Promise<any> {

        console.log(`Adding push subscription`);
        console.log(subscription_);
        if (user_.user_settings) user_.user_settings.push_subscriptions.push(subscription_);
        else {

            // Initialize user settings object for student
            if (Object.prototype.hasOwnProperty.call(user_, 'auth_info')) {
                initializeStudentSettings(user_ as DocumentType<Student>);
            }
            // Initialize user settings object for landlord
            else {
                initializeLandlordSettings(user_ as DocumentType<Landlord>);
            }
            user_.user_settings!.push_subscriptions.push(subscription_);
        }
        return user_.save();
    }

    /**
     * @desc Save the notification information on the student's mongoose document
     * so that they can see it in the app.
     */
    async addStudentNotificationInformation ({
        subject, body, action, student_id
    }: StudentNotif) {

        if (!ObjectId.isValid(student_id)) return;
        let student: DocumentType<Student> = await StudentModel.findById(student_id) as DocumentType<Student>;
        if (!student) return;

        // create notifiction.
        let notif: StudentNotification = new StudentNotification();
        notif.date_created = new Date().toISOString();
        notif.subject = subject;
        notif.body = body;
        if (action) notif.action = action;

        // add the notification to the student notifications
        if (student.notifications == undefined) student.notifications = [];
        student.notifications.push(notif);

        // save the student info
        student.save();

    }

    /**
     * Send a notification to a user through pusn notifications & email
     * @param user_: Student | Landlord => The user to send a notification to
     * @param options => Options about what type of notifications should be sent
     */
    sendNotification (
        user_: DocumentType<Student> | DocumentType<Landlord>, 
        notification_data: NotificationProps,
        // default options
        options: SendNotificationOptions = {
            sendEmailNotifiation: false,
            sendPushNotification: true
        }) {

            // send push notifications
            if (options.sendPushNotification) {
                for (let i = 0; user_.user_settings && i < user_.user_settings.push_subscriptions.length; ++i) {
                    this._sendPushNotificationToSubscription_( user_.user_settings.push_subscriptions[i], notification_data );
                }
            }

            // send email notifications
            if (options.sendEmailNotifiation) {
                SendGrid.sendMail({
                    to: user_.email.toString(),
                    email_template_id: SendGridTemplate.NOTIFICATIONS,
                    template_params: {
                        title: notification_data.title,
                        body: notification_data.body,
                        ...(
                            notification_data.emailOptions ?
                            {
                                ...(notification_data.emailOptions.action_text? {action_text: notification_data.emailOptions.action_text} : {}),
                                ...(notification_data.emailOptions.action_url? {action_url: notification_data.emailOptions.action_url} : {}),
                            }:
                            {}
                        )
                    }
                })
            }
    }

    private _sendPushNotificationToSubscription_ (subscription: PushSubscription, notification_info: NotificationProps) {
        webpush.sendNotification(
            // the subscription object
            {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth
                }
            },

            // the payload of the notification
            JSON.stringify({
                title: notification_info.title,
                body: notification_info.excerpt
            })
        )
    }
}

interface NotificationEmailProps {
    action_text?: string
    action_url?: string
}

interface NotificationProps {
    title: string
    excerpt: string
    body: string
    emailOptions?: NotificationEmailProps
}

interface SendNotificationOptions {
    sendEmailNotifiation: boolean
    sendPushNotification: boolean
}