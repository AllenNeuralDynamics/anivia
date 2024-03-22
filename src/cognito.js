/**
 * This file contains the JavaScript code for accessing AWS Cognito services.
 * Cognito is used for AIND user authentication and authorization.
 * 
 * Links:
 * - AWS JavaScript SDK: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/
 */

// ========== AWS CONFIGURATION AND SETUP ====================
const COGNITO_REGION = 'us-west-2';
const COGNITO_CLIENT_ID = '4i7qgk46rvmna1sesnljkoihnb';
const COGNITO_USERPOOL_ID = 'us-west-2_ii4G6y7Qk';
const COGNITO_IDENTITY_POOL_ID = 'us-west-2:3723a551-9e26-4882-af4e-bcd0310b9885';
const COGNITO_LOGIN_KEY = `cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USERPOOL_ID}`;
const S3_BUCKET_NAME = 'aind-anivia-data-dev';

if (!AWS.config.credentials) {
  // TODO: Check if this is necessary on non-local environments
  AWS.config.update({
    region: COGNITO_REGION,
    accessKeyId: 'PLACEHOLDER',
    secretAccessKey: 'PLACEHOLDER'
  });
  console.log("Default AWS credentials created with placeholders.");
}
const INIT_AWS_CREDENTIALS = AWS.config.credentials;

var currentUser = {
  username: '',
  userIdToken: '',
  userAccessToken: '',
};
var AWSCognito = new AWS.CognitoIdentityServiceProvider();
var s3 = new AWS.S3();
var s3exp_lister = null;

// ========== COGNITO FUNCTIONS ====================
/**
 * Wrapper for AWSCognitoServiceProvider.globalSignOut()
 * @param {*} callback - custom callback function
 */
function cognitoSignOut(callback) {
  var params = {
    AccessToken: currentUser.userAccessToken
  };
  AWSCognito.globalSignOut(params, (err, data) => callback(err));
}

/**
 * Wrapper for AWSCognitoServiceProvider.initiateAuth()
 * @param {*} callback - custom callback function
 */
function cognitoInitiateAuth(callback) {
  currentUser.username = $('#username').val();
  const authenticationDetails = {
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: {
      USERNAME: $('#username').val(),
      PASSWORD: $("#password").val(),
    },
    ClientId: COGNITO_CLIENT_ID,
  };
  AWSCognito.initiateAuth(authenticationDetails, callback);
}

/**
 * Set temporary credentials using the IdentityPoolId and IdToken recieved from Cognito,
 * and re-initialize the S3 client.
 * @param {*} idToken - user id token from Cognito auth result
 * @param {*} accessToken - user access token from Cognito auth result
 */
function setTempCredentials(idToken, accessToken) {
  currentUser.userIdToken = idToken;
  currentUser.userAccessToken = accessToken;    
  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: COGNITO_IDENTITY_POOL_ID,
    Logins: {
      [COGNITO_LOGIN_KEY]: currentUser.userIdToken
    }
  });
  s3 = new AWS.S3();
}

/**
 * Clear cached credentials and reset currentUser object and S3 client.
 */
function resetTempCredentials() {
  AWS.config.credentials.clearCachedId();
  AWS.config.credentials = INIT_AWS_CREDENTIALS;
  currentUser = {
    username: '',
    userIdToken: '',
    userAccessToken: ''
  };
  s3 = new AWS.S3();
}

// ========== COGNITO UI ====================
/**
 * Prompt user for login credentials.
 * @param {*} successCallback - Optional callback function to execute after successful login.
 */
function promptLogin(successCallback = null) {
  bootbox.confirm({
    title: 'Log in',
    message: "<form id='login-info' action=''>\
    <label style='width:90px;'>Username:</label><input type='email' name='username' id='username' style='min-width:250px;'/><br/>\
    <label style='width:90px;'>Password:</label><input type='password' name='password' id='password' style='min-width:250px;'/>\
    </form>",
    buttons: { confirm: { label: 'Log in' } },
    callback: (result) => {
      if (result) {
        if (!$('#username').val() || !$('#password').val()) {
          console.error("Username and password are required.")
          promptLogin();
          return;
        }
        cognitoInitiateAuth((err, result) => cognitoInititateAuthCallback(err, result, successCallback));
      } else {
        console.log("User cancelled login.");
      }
    }
  });
}

/**
 * Prompt user to confirm logout.
 */
function promptLogout() {
  bootbox.confirm({
    title: 'Log out',
    message: 'Are you sure?',
    buttons: { confirm: { label: 'Log out'} },
    callback: (result) => {
      if (result) {
        cognitoSignOut(cognitoSignOutCallback);
      } else {
        console.log("User cancelled logout.");
      }
    }
  });
}

/**
 * Custom callback function for cognito.initiateAuth.
 * If auth successful, set temporary credentials and update UI.
 * Otherwise, re-prompt for login.
 * @param {*} err - Error object
 * @param {*} result - AuthenticationResult object
 * @param {*} successCallback - Optional callback function to execute after successful login.
 */
function cognitoInititateAuthCallback(err, result, successCallback = null) {
  if (err) {
    currentUser.username = ''
    console.error(err)
    bootbox.confirm({
      title: 'Login Unsuccessful',
      message: `Error: ${err.message}`,
      buttons: { confirm: { label: 'Try again' } },
      callback: (result) => { if (result) promptLogin(); }
    });
  } else {
    console.log("Authenticated successfully.")
    const { IdToken, AccessToken } = result.AuthenticationResult;
    setTempCredentials(IdToken, AccessToken);
    $('#login').hide();
    $('#logout').show();
    $('#username-display').text(currentUser.username);
    if (successCallback) successCallback();
  }
}

/**
 * Custom callback function for cognito.globalSignOut.
 * If sign out successful, clear current user tokens and reset UI.
 * Otherwise, notify user of error.
 * @param {*} err 
 */
function cognitoSignOutCallback(err) {
  if (err) {
    console.error("Error signing out", err, err.stack);
    bootbox.alert("Error signing out. Error: " + err.message);
  }
  else {
    console.log("User signed out.");
    resetTempCredentials();
    $('#login').show();
    $('#logout').hide();
    $('#username-display').text('');
  }
}

// ========== S3 UI ====================
/**
 * Prompt user to select files from anivia S3 bucket.
 * First checks if user is logged in, and prompts for login if not.
 */
function sel_s3_images() {
  if (currentUser.username === '') {
    promptLogin(sel_s3_images);
    return;
  }
  // TODO: switch from listing contents to displaying in file explorer
  (s3exp_lister = s3list()).go();
}

/**
 * TODO: Lists objects in an S3 bucket and displays them in a file explorer table.
 * @param {*} config 
 * @returns 
 */
function s3list() {
  const completecb = (data) => {
    // TODO: Callback function to draw the S3 object list into the table
    console.log(data.Contents);
  }
  var params = {
    Bucket: S3_BUCKET_NAME,
  };
  var scope = {
    Contents: [],
    CommonPrefixes: [],
    params: params,
    stop: false,
    completecb: completecb
  };
  return {
    // Callback that the S3 API makes when an S3 listObjectsV2 request completes (successfully or in error)
    // Note: We do not continue to list objects if response is truncated
    cb: function (err, data) {
      if (err) {
        scope.stop = true;
        bootbox.alert("Error accessing S3 bucket " + scope.params.Bucket + ". Error: " + err);
      } else {
        scope.Contents.push.apply(scope.Contents, data.Contents);
        scope.CommonPrefixes.push.apply(scope.CommonPrefixes, data.CommonPrefixes);
        if (scope.stop) {
          console.log('Bucket ' + scope.params.Bucket + ' stopped');
          return;
        } else if (data.IsTruncated) {
          console.log('Bucket ' + scope.params.Bucket + ' truncated before complete');
        }
        console.log('Retrieved ' + scope.Contents.length + ' objects from ' + scope.params.Bucket + ', including ' +
          scope.CommonPrefixes.length + ' prefixes');
        scope.completecb(scope, true);
      }
    },
    go: function () {
      scope.cb = this.cb;
      s3.makeRequest('listObjectsV2', scope.params, this.cb);
    },
    stop: function () {
      scope.stop = true;
      if (scope.completecb) {
        scope.completecb(scope, false);
      }
    }
  };
}