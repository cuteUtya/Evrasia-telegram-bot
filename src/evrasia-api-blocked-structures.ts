
export class structures {
    static blockedAdresses: string[] = [];
    static issuedCodes: string[] = [];
    static blockedAccounts: BlockedAccount[] = [];

}

export interface BlockedAccount {
    phone: string;
    triggeredAdress: number;
}