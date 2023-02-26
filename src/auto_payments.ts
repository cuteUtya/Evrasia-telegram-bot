import axios from 'axios';
import { changeBalance } from './botEntry';

const daClientId = '<your-da-client-id>';
const daClientSecret = '<your-da-client-secret>';
const daGrantType = 'client_credentials';

const qiwiApiKey = '<your-qiwi-api-key>';
const qiwiWallet = '<your-qiwi-wallet>';

export function doPayments() {
    var daAccessToken;
    axios.post('https://auth.donationalerts.com/oauth/token', {
        grant_type: daGrantType,
        client_id: daClientId,
        client_secret: daClientSecret,
    })
        .then(daResponse => {
            daAccessToken = daResponse.data.access_token;
            console.log('Donation Alerts access token:', daAccessToken);
        }).catch(error => {
            console.error('Error authenticating with Donation Alerts:', error);
        });
    function checkForNewTransactions() {
        function onNewDonation(source, text, amount) {
            console.log(`New donation from ${source}: "${text}" for ${amount}`);
            const regex = /\b\d{1,11}\b/;
            const match = regex.exec(text);
            if (match) {
                const userId = match[0];
                console.log(`User ID: ${userId}`);
                changeBalance(parseInt(userId), amount);
            }
        }

        axios.get('https://donationalerts.com/api/v1/alerts/donations', {
            headers: {
                Authorization: `Bearer ${daAccessToken}`
            }
        })
            .then(daResponse => {
                const daDonations = daResponse.data;
                console.log('Recent Donation Alerts donations:', daDonations);
                daDonations.forEach(daDonation => {
                    const text = daDonation.message;
                    const amount = daDonation.amount;
                    onNewDonation('Donation Alerts', text, amount);
                });
            })
            .catch(error => {
                console.error('Error retrieving Donation Alerts donations:', error);
            });

        axios.get(`https://edge.qiwi.com/payment-history/v2/persons/${qiwiWallet}/payments?operation=IN`, {
            headers: {
                Authorization: `Bearer ${qiwiApiKey}`
            }
        })
            .then(qiwiResponse => {
                const qiwiPayments = qiwiResponse.data.data;
                console.log('Recent Qiwi payments:', qiwiPayments);
                qiwiPayments.forEach(qiwiPayment => {
                    const text = qiwiPayment.comment;
                    const amount = qiwiPayment.sum.amount;
                    onNewDonation('Qiwi', text, amount);
                });
            })
            .catch(error => {
                console.error('Error retrieving Qiwi payments:', error);
            });
    }
    setInterval(checkForNewTransactions, 30000);
}
