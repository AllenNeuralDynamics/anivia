/**
 * This file contains the JavaScript code for accessing AWS Cognito and AWS S3 services.
 * Cognito is used for AIND user authentication and authorization.
 * S3 is used for storing and retrieving data from the AIND Anivia Data bucket(s).
 * 
 * Links:
 * - AWS JavaScript SDKv2: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/
 */

// ========== AWS CONFIGURATION AND SETUP ====================
const COGNITO_REGION = 'us-west-2';
const COGNITO_CLIENT_ID = '4i7qgk46rvmna1sesnljkoihnb';
const COGNITO_USERPOOL_ID = 'us-west-2_ii4G6y7Qk';
const COGNITO_IDENTITY_POOL_ID = 'us-west-2:3723a551-9e26-4882-af4e-bcd0310b9885';
const COGNITO_LOGIN_KEY = `cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USERPOOL_ID}`;
const S3_BUCKET_NAME = 'aind-anivia-data-dev';
const S3_DELIMITER = '/';
// TODO: check expiry times
const S3_GET_SIGNED_URL_EXPIRY = 15;    // 15 seconds
const S3_GET_SIGNED_URLS_EXPIRY = 300;  // 5min, extra for multiple urls

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

// global variables
var currentUser = {
  username: '',
  userIdToken: '',
  userAccessToken: '',
};
var s3Prefix = ''; // S3 prefix for current folder
var AWSCognito = new AWS.CognitoIdentityServiceProvider(); // Cognito client
var s3 = new AWS.S3(); // Default S3 client

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
    buttons: { confirm: { label: 'Log out' } },
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

// ========== S3 FUNCTIONS ====================
/**
 * Wrapper for S3.listObjectsV2.
 * Uses the global S3 client to make an authenticated listObjectsV2 request.
 * Uses custom s3draw callback to update the UI.
 */
function s3list() {
  var scope = {
    Contents: [],
    CommonPrefixes: [],
    params: {
      Bucket: S3_BUCKET_NAME,
      Delimiter: S3_DELIMITER,
      Prefix: s3Prefix,
    },
    stop: false,
    completecb: s3draw
  };
  return {
    // Callback that the S3 API makes when an S3 listObjectsV2 request completes (successfully or in error)
    // Note: We do not continue to list objects if response is truncated
    cb: function (err, data) {
      if (err) {
        scope.stop = true;
        bootbox.alert({
          title: `Error accessing S3 bucket ${scope.params.Bucket}`,
          message: `Error: ${err.message}`,
        });
      } else {
        scope.Contents.push.apply(scope.Contents, data.Contents);
        scope.CommonPrefixes.push.apply(scope.CommonPrefixes, data.CommonPrefixes);
        if (scope.stop) {
          console.log(`Bucket ${scope.params.Bucket} stopped`);
          return;
        } else if (data.IsTruncated) {
          console.log(`Bucket ${scope.params.Bucket} truncated before complete`);
        }
        console.log(`Retrieved ${scope.Contents.length} objects from ${scope.params.Bucket}/${scope.params.Prefix ?? ''}, including ${scope.CommonPrefixes.length} folders`);
        scope.completecb(scope, true);
      }
    },
    go: function () {
      scope.cb = this.cb;
      $('#tb-s3objects').DataTable().clear();
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

/**
 * Loads a file or all files in a folder from S3 into the VIA app.
 * Gets signed URL(s) for each S3 file based on the path.
 * Calls the VIA project_file_add_url_input_done() with the URL(s) to load the file(s) into the app.
 * @param {string} path - S3 path to file or folder
 */
function load_s3_into_app(path) {
  const filepath = path.split('/').slice(1).join('/')
  const isFolder = filepath.endsWith('/');
  var inputForVia = {
    'url': { value : '' },
    'url_list': { value : '' }
  };
  // TODO: check if we want to use getSignedUrl or getObject directly
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getSignedUrl-property
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property
  // TODO: resolve current issue with expiry for signed urls
  // Currently, if user does not view the image within the expiry time, the image will not load
  var params = {
    Bucket: S3_BUCKET_NAME,
    Expires: isFolder ? S3_GET_SIGNED_URLS_EXPIRY : S3_GET_SIGNED_URL_EXPIRY
  };
  if (isFolder) {
    // get list of objects in this folder
    s3.makeRequest('listObjectsV2', { Bucket: S3_BUCKET_NAME, Prefix: filepath }, (err, data) => {
      if (err) {
        console.error('err:', err);
        bootbox.alert(`S3 Error: ${err.message}`);
      } else {
        // get pre-signed urls for each file in the folder
        var urls = data.Contents.map(obj => {
          params.Key = obj.Key;
          return s3.getSignedUrl('getObject', params);
        });
        // call the VIA input_done function with the list of urls
        inputForVia.url_list.value = urls.join('\n');
        project_file_add_url_input_done(inputForVia);
      }
    });
  } else {
    // get pre-signed url for file
    params.Key = filepath;
    s3.getSignedUrl('getObject', params, (err, url) => {
      if (err) {
        console.error('err:', err);
        bootbox.alert(`S3 Error: ${err.message}`);
      } else {
        // call the VIA input_done function with the url
        inputForVia.url.value = url;
        project_file_add_url_input_done(inputForVia);
      }
    });
  }
}

// ========== S3 UI ====================
/**
 * Modal to prompt user to select files from anivia S3 bucket.
 * First prompts user to log in if not already logged in.
 * Initializes a DataTable to display S3 objects.
 * Includes delegated event handlers for folder entry, selection, reset, and back buttons.
 */
function sel_s3_images() {
  if (currentUser.username === '') {
    promptLogin(sel_s3_images);
    return;
  }
  bootbox.prompt({
    title: "Select from AWS S3",
    message:
    `<div class='card'>\
      <h4 class='card-header'>\
        <div role='group' class='btn-group'>\
          <button type='button' class='btn btn-outline-secondary' id='btn-s3-reset' disabled>Reset</button>\
          <button type='button' class='btn btn-outline-secondary' id='btn-s3-back' disabled>Back</button>\
        </div>\
        ${S3_BUCKET_NAME}<span id='s3-prefix'>\
      </h4>\
      <div class='card-body'>\
        <table class='table-bordered table-hover compact' id='tb-s3objects' style='width:100%'>\
          <thead><tr><th>Object</th><th>Last Modified</th><th>Size</th></tr></thead>\
          <tbody id='tbody-s3objects'></tbody>\
        </table>\
      </div>\
    </div>`,
    required: 'true',
    placeholder: 'Please select a file or folder by CLICKING in the browser above.',
    size: 'extra-large',
    onShow: () => {
      // Initialize UI including rendering folders as clickable buttons
      $('.bootbox-input-text').prop('readonly', true);
      $('#tb-s3objects').DataTable({
        iDisplayLength: 10,
        order: [[1, 'asc'], [0, 'asc']],
        aoColumnDefs: [
          {
            "aTargets": [0], "mData": "Key",
            "mRender": (data, type) => {
              if (type === 'display') {
                // display folders as clickable buttons, otherwise display file as span
                // both have the key as data-path
                if (data.endsWith('/')) {
                  let folderName = data.split('/').slice(-2)[0] + '/';
                  return `<button type="button" class="btn btn-link" data-s3="folder" data-path="${data}">${folderName}</button>`;
                } else {
                  let fileName = data.split('/').slice(-1)[0];
                  return `<span data-s3="object" data-path="${data}">${fileName}</button>`;
                }
              } 
              return data;
            }
          },
          { "aTargets": [1], "mData": "LastModified", "mRender": (data) => { return data ?? "" } },
          { "aTargets": [2], "mData": "Size", "mRender": (data) => { return data ?? "" } }
        ]
      });
      s3list().go();
    },
    buttons: {
      confirm: { label: 'Select' },
      cancel: { label: 'Cancel' }
    },
    callback: (result) => {
      if (result) {
        console.log("Selected S3 folder: " + result);
        load_s3_into_app(result);
      }
      // Reset s3Prefix for next selection
      s3Prefix = '';
    }
  });

  // ========== DELEGATED EVENT HANDLERS ==========
  // Clickable folder button to update global s3Prefix and refresh the DataTable
  $('#tb-s3objects').on('click', 'tbody td button', e => {
    e.preventDefault();
    s3Prefix = e.target.dataset.path;
    s3list().go();
  });

  // Clickable rows for row selection (user can select a folder or file row)
  $('#tb-s3objects').on('click', 'tbody tr', (e) => {
    e.preventDefault();
    let classList = e.currentTarget.classList;
    let folderElement = e.currentTarget.firstChild.firstChild
    // If row is already selected, deselect it and revert input to default
    if (classList.contains('selected')) {
      classList.remove('selected');
      classList.remove('bg-primary')
      folderElement.classList.remove('text-white');
      $('.bootbox-input-text').val(s3Prefix ? [S3_BUCKET_NAME, s3Prefix].join('/') : '');
      console.log(folderElement.dataset.path + ' deselected');
    }
    // Otherwise, clear other selections, select the new row, and update input
    // NOTE: to only allow folders, check folderElement.dataset?.s3 === "folder"
    else {
      $('#tb-s3objects').DataTable().rows('.selected').nodes().each((row) => {
        row.classList.remove('selected')
        row.classList.remove('bg-primary')
        row.firstChild.firstChild.classList.remove('text-white');
      });
      classList.add('selected');
      classList.add('bg-primary');
      folderElement.classList.add('text-white');
      $('.bootbox-input-text').val([S3_BUCKET_NAME, folderElement.dataset.path].join('/'));
      console.log(folderElement.dataset.path + ' selected');
    }
  });

  // Reset button to clear the current prefix and refresh the DataTable
  $('#btn-s3-reset').on('click', (e) => {
    e.preventDefault();
    console.log("Reset button clicked");
    s3Prefix = '';
    s3list().go();
  });

  // Back button to navigate up one level and refresh the DataTable
  $('#btn-s3-back').on('click', (e) => {
    e.preventDefault();
    console.log("Back button clicked");
    if (s3Prefix) {
      const parentPrefix = s3Prefix.split('/').slice(0, -2).join('/') + '/';
      s3Prefix = (parentPrefix === '/') ? '' : parentPrefix
      s3list().go();
    }
  });
}

// Callback function to draw results from s3list into the table and update the UI
function s3draw(data, complete) {
  // Update header and default input
  // Enable/disable reset and back buttons
  if (data.params.Prefix) {
    $('#s3-prefix').text(`/${data.params.Prefix}`);
    $('.bootbox-input-text').val([S3_BUCKET_NAME, data.params.Prefix].join('/'));
    $('#btn-s3-reset').prop('disabled', false);
    $('#btn-s3-back').prop('disabled', false);
  } else {
    $('#s3-prefix').text('');
    $('.bootbox-input-text').val('');
    $('#btn-s3-reset').prop('disabled', true);
    $('#btn-s3-back').prop('disabled', true);
  }
  // Add common prefixes (folders at this level) to DataTable
  $.each(data.CommonPrefixes, function (i, prefix) {
    $('#tb-s3objects').DataTable().rows.add([{
      Key: prefix.Prefix
    }]);
  });
  // Add S3 objects to DataTable (filters out the current folder)
  $('#tb-s3objects').DataTable().rows.add(
    data.Contents.filter(el => el.Key !== data.params.Prefix)
  ).draw();
}

