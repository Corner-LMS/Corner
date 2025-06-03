// const formData = require('form-data');
// const Mailgun = require('mailgun.js');
// const mailgun = new Mailgun(formData);
// const mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY || 'key-yourkeyhere' });

// mg.messages.create('sandbox-123.mailgun.org', {
//     from: "Excited User <noreply@cornerdiscussion.com>",
//     to: ["cynthiam@cornerdiscussion.com"],
//     subject: "Hello",
//     text: "Testing some Mailgun awesomeness!",
//     html: "<h1>Testing some Mailgun awesomeness!</h1>"
// })
//     .then(msg => console.log(msg)) // logs response data
//     .catch(err => console.log(err)); // logs any error
const dotenv = require('dotenv');
dotenv.config();
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY || 'key-yourkeyhere' });

console.log(process.env.MAILGUN_API_KEY);
mg.messages
    .create('cornerdiscussion.com', {
        from: 'noreply@cornerdiscussion.com',
        to: ['cynthiam@cornerdiscussion.com'],
        subject: 'Verification Code',
        text: 'Your verification code is 123456',
    })
    .then(console.log)
    .catch(console.error);

