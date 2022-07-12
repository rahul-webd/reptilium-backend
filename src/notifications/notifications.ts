import { db } from "..";
import { Reference, DataSnapshot } from '@firebase/database-types/index'

export const addNotification = async (message: string) => {
    const notificationsRef: Reference = db.ref('notifications');

    try {
        
        const r: Reference = await notificationsRef.push(message);

        return {
            success: true,
            key: r.key
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
                notifications: s,
            }
        }
    } catch (error) {
        
        console.log(error);
    }

    return {
        notifications: []
    }
}

export const remNotification = async (k: string) => {
    const notificationsRef: Reference = db.ref(`notifications/${k}`);

    try {

        await notificationsRef.remove();

        return {
            removed: true
        }
    } catch (error) {

        console.log(error);

        return {
            removed: false
        }
    }
}