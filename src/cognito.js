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

if (!AWS.config.credentials) {
  // TODO: Check if this is necessary on non-local environments
  AWS.config.update({
    region: COGNITO_REGION,
    accessKeyId: 'PLACEHOLDER',
    secretAccessKey: 'PLACEHOLDER'
  });
  console.log("Default AWS credentials created with placeholders.");
}
var currentUser = {
  username: '',
  userIdToken: '',
  userAccessToken: '',
};
var AWSCognito = new AWS.CognitoIdentityServiceProvider();

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
 * Set temporary credentials using the IdentityPoolId and IdToken recieved from Cognito.
 * @param {*} idToken 
 * @param {*} accessToken 
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
}

/**
 * Clear cached credentials and reset currentUser object.
 */
function resetTempCredentials() {
  AWS.config.credentials.clearCachedId();
  currentUser = {
    username: '',
    userIdToken: '',
    userAccessToken: ''
  };
}

// ========== COGNITO UI ====================
/**
 * Prompt user for login credentials.
 */
function promptLogin() {
  bootbox.confirm({
    title: 'Log in',
    message: "<form id='login-info' action=''>\
    <label style='width:90px;'>Username:</label><input type='email' name='username' id='username'/><br/>\
    <label style='width:90px;'>Password:</label><input type='password' name='password' id='password'/>\
    </form>",
    buttons: { confirm: { label: 'Log in' } },
    callback: (result) => {
      if (result) {
        if (!$('#username').val() || !$('#password').val()) {
          console.error("Username and password are required.")
          promptLogin();
          return;
        }
        cognitoInitiateAuth(cognitoInititateAuthCallback);
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
 * @param {*} err 
 * @param {*} result 
 */
function cognitoInititateAuthCallback(err, result) {
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

