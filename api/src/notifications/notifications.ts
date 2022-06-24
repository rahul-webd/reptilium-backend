import { db } from "..";
import { Reference, DataSnapshot } from '@firebase/database-types/index'


export const addNotification = async (message: string) => {
    const notificationsRef: Reference = db.ref('notifications');

    try {
        
        await notificationsRef.push(message);

        return {
            success: true
        }
    } catch (error) {
        
        console.log(error);
    }

    return {
        success: false
    }
}

export const getNotifications = async () => {
    const notificationsRef: Reference = db.ref('notifications');

    try {
        
        const s: DataSnapshot = await notificationsRef.get();
        
        if (s.exists()) {

            return {
                notifications: Object.values(s.val()),
            }
        }
    } catch (error) {
        
        console.log(error);
    }

    return {
        notifications: []
    }
}