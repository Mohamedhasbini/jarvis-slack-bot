const validator = require('validator');

// Disposable / throwaway email domains — blocked at signup
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com',
  '10minutemail.com','sharklasers.com','guerrillamail.info','guerrillamail.biz',
  'guerrillamail.de','guerrillamail.net','guerrillamail.org','spam4.me',
  'trashmail.com','trashmail.me','trashmail.net','dispostable.com','fakeinbox.com',
  'mailnull.com','spamgourmet.com','maildrop.cc','mailnesia.com','discard.email',
  'temp-mail.org','tempr.email','tempinbox.com','getnada.com','mailtemp.info',
  'throwam.com','spamgourmet.net','spamgourmet.org','gishpuppy.com','mailexpire.com',
  'throwam.com','filzmail.com','trashmail.at','trashmail.io','trashmail.me',
  'spambog.com','spamcero.com','spamevader.com','spamfree24.org','spamgob.com',
  'spamherelots.com','spamhereplease.com','spamoff.de','spamslicer.com',
  'spamspot.com','spamthis.co.uk','tempemail.net','temporaryemail.net',
  'tempsky.com','tempomail.fr','thanksnospam.info','tittbit.in','trbvm.com',
  'uggsrock.com','uglyemail.com','veryrealemail.com','viditag.com','wetrainbayarea.org',
]);

function isDisposableEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'Email is required';
  if (!validator.isEmail(email)) return 'Invalid email address';
  if (isDisposableEmail(email)) return 'Disposable email addresses are not allowed';
  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password too long';
  return null;
}

module.exports = { validateEmail, validatePassword };
