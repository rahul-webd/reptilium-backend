import * as admin from 'firebase-admin';
import { getTableRows } from './helpers';

const colName = 'nft.reptile';

interface simpleNames {
    [id: string]: string
}

export const setShopItems = async () => {
    const shopCode: string = `shop.cait`;
    const scope: string = `shop.cait`;
    const tables: simpleNames = {
        menu: `menu`,
        limits: `limits`
    }
    const limit: number = 9999;

    const menuRows: any = (await getTableRows(shopCode, scope, tables.menu, limit) as any).rows;
    const limitsRows: any = (await getTableRows(shopCode, scope, tables.limits, limit) as any).rows;

    if (menuRows && limitsRows) {
        const colMenuRows = menuRows.filter((menuRow: any) => 
            menuRow.CollectionName === colName);
        const colMenuMemos = colMenuRows.map((colMenuRow: any) =>
            colMenuRow.Memo)
        const colLimitsRows = limitsRows.filter((limitsRow: any) =>
            colMenuMemos.includes(limitsRow.Memo));
        const sortedColLimitRows: Array<any> = [colMenuMemos.length];

        colLimitsRows.forEach((colLimitRow: any) => {
            const limitRowMemo = colLimitRow.Memo;
            const menuRowIndex = colMenuMemos.indexOf(limitRowMemo);
            sortedColLimitRows[menuRowIndex] = colLimitRow;
        });

        const shopItemRows = colMenuRows.map((menuRow: any, index: number) => {
            const memo = menuRow.Memo;
            const templateId = menuRow.TemplateId;
            const price = menuRow.Price;
            const limitRow = sortedColLimitRows[index];
            
            let limit = {}
            if (limitRow) {
                const startTime = limitRow.StartTime;
                const stopTime = limitRow.StopTime;
                const leftToSell = limitRow.LeftToSell;
                const maxToSell = limitRow.MaxToSell;
                const maxPerAccount  = limitRow.MaxPerAccount;
                const secondsBetween = limitRow.SecondsBetween;
                limit = { startTime, stopTime, leftToSell, maxToSell,
                    maxPerAccount, secondsBetween }
            }    
            return { memo, templateId, price, limit }
        });

        const shopItemsRef = admin.database().ref('shop_items');
        await shopItemsRef.set(shopItemRows, err => {
            if (err) {
                console.log(err);
                return;
            }
            console.log(`shop items update completed`);
        });
    }
    return;
}