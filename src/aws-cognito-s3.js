/**
 * This file contains the JavaScript code for accessing AWS Cognito and AWS S3 services.
 * 1. Cognito is used for AIND user authentication and authorization.
 *    Login, logout, and token management functions and UI are customized for the AIND Anivia app.
 * 2. S3 is used for storing and retrieving data from the AIND Anivia Data bucket(s).
 *    S3 list and get functions are customized to load a file or folder into the AIND Anivia app.
 *    A popup dialog (based on AWS S3 Explorer) is provided for users to select a file/folder.
 * 
 * This file is organized in with the following sections:
 * 1. AWS Configuration and Setup
 * 2. Cognito Functions (AWS SDK-related)
 * 3. Cognito UI
 * 4. S3 Functions (AWS SDK-related)
 * 5. S3 UI
 * 6. Utility Functions
 * 
 * Links:
 * - AWS JavaScript SDKv2: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/
 * - AWS JavaScript S3 Explorer: https://github.com/awslabs/aws-js-s3-explorer
 */

// ========== AWS CONFIGURATION AND SETUP ====================
// TODO: check if we want to move these to a separate config
const COGNITO_REGION = 'us-west-2';
const COGNITO_CLIENT_ID = '4i7qgk46rvmna1sesnljkoihnb';
const COGNITO_USERPOOL_ID = 'us-west-2_ii4G6y7Qk';
const COGNITO_IDENTITY_POOL_ID = 'us-west-2:3723a551-9e26-4882-af4e-bcd0310b9885';
const COGNITO_LOGIN_KEY = `cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USERPOOL_ID}`;
const S3_BUCKET_NAME = 'aind-anivia-data-dev';
const S3_DELIMITER = '/';

if (!AWS.config.credentials) {
  // TODO: check if this is necessary on non-local environments
  AWS.config.update({ region: COGNITO_REGION, accessKeyId: 'PLACEHOLDER', secretAccessKey: 'PLACEHOLDER' });
  console.log("Default AWS credentials created with placeholders.");
}
const INIT_AWS_CREDENTIALS = AWS.config.credentials;

// global variables
var currentUser = {
  username: '',
  userIdToken: '',
  userAccessToken: '',
};
var s3Prefix = '';                                          // S3 prefix for current folder
var AWSCognito = new AWS.CognitoIdentityServiceProvider();  // Cognito client
var s3 = new AWS.S3();                                      // Default S3 client

// ==================== COGNITO FUNCTIONS ====================
/**
 * Wrapper for AWS.CognitoServiceProvider.globalSignOut()
 * @param {*} callback - custom callback function (default to cognitoSignOutCallback)
 */
function cognitoSignOut(callback = cognitoSignOutCallback) {
  var params = {
    AccessToken: currentUser.userAccessToken
  };
  AWSCognito.globalSignOut(params, callback);
}

/**
 * Wrapper for AWS.CognitoServiceProvider.initiateAuth()
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
 * @param {string} idToken - user id token from Cognito auth result
 * @param {string} accessToken - user access token from Cognito auth result
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
  // Any AWS services we use must be reinitialized
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
  // Any AWS services we use must be reinitialized
  s3 = new AWS.S3();
}

// ==================== COGNITO UI ====================
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
        cognitoSignOut();
      } else {
        console.log("User cancelled logout.");
      }
    }
  });
}

/**
 * Custom callback function for cognitoInitiateAuth()
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
 * Custom callback function for cognitoSignOut()
 * If sign out successful, clear current user tokens and reset UI.
 * Otherwise, notify user of error.
 * @param {*} error - Error if cognitoSignOut returned an error
 */
function cognitoSignOutCallback(error) {
  if (error) {
    logErrorAndAlertUser("Error signing out", error)
  }
  else {
    console.log("User signed out.");
    resetTempCredentials();
    $('#login').show();
    $('#logout').hide();
    $('#username-display').text('');
  }
}

// ==================== S3 FUNCTIONS ====================
/**
 * Wrapper for AWS.S3.listObjectsV2.
 * Uses the global S3 client to make an authenticated listObjectsV2 request.
 * @param {*} callback - Callback function (defaults to use s3draw() to update the UI)
 */
function s3list(callback = s3draw) {
  var scope = {
    Contents: [],
    CommonPrefixes: [],
    params: {
      Bucket: S3_BUCKET_NAME,
      Delimiter: S3_DELIMITER,
      Prefix: s3Prefix,
    },
    stop: false,
    completecb: callback
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
        console.log(`Listed ${scope.Contents.length} objects from ${scope.params.Bucket}/${scope.params.Prefix ?? ''}, including ${scope.CommonPrefixes.length} folders`);
        scope.completecb(scope, true);
      }
    },
    go: function () {
      scope.cb = this.cb;
      s3.makeRequest('listObjectsV2', scope.params, this.cb);
    },
    stop: function () {
      scope.stop = true;
      scope.completecb(scope, false);
    }
  };
}

/**
 * Loads files from S3 into the VIA app.
 * If target path is a folder, load all files in the folder by first calling AWS.S3.listObjectsV2to get folder contents.
 * For each file, call AWS.S3.getObject to get the file.
 * Calls project_file_add_local() function from via.js to add the file(s) to the app.
 * @param {string} path - S3 path to file or folder
 */
function load_s3_into_app(path) {
  const filepath = path.split('/').slice(1).join('/')
  var params = {
    Bucket: S3_BUCKET_NAME,
    Key: filepath
  };
  var fakeEvent = { target: { files: [] } };
  if (pathIsFolder(filepath)) {
    // get list of objects in this folder
    s3.makeRequest('listObjectsV2', { Bucket: S3_BUCKET_NAME, Prefix: filepath }, async (err, data) => {
      if (err) {
        logErrorAndAlertUser("S3 Error", err)
      } else {
        // get each file, then add all files to VIA
        await Promise.all(data.Contents.map((obj) => {
          let filepath = obj.Key;
          return new Promise((resolve, reject) => {
            params.Key = filepath;
            s3.makeRequest('getObject', params, (err, data) => {
              if (err) {
                reject(err);
              } else {
                var file = new File([data.Body], filepath, { type: data.ContentType });
                resolve(file);
              }
            });
          });
        })).then((files) => {
          console.log(`Retrieved ${files.length} files from ${path}`)
          fakeEvent.target.files = files;
          project_file_add_local(fakeEvent);
        }).catch((err) => {
          logErrorAndAlertUser("S3 Download Error", err)
        });
      }
    });
  } else {
    s3.makeRequest('getObject', params, (err, data) => {
      if (err) {
        logErrorAndAlertUser("S3 Error", err)
      } else {
        console.log(`Retrieved file from ${path}`)
        var file = new File([data.Body], filepath, { type: data.ContentType });
        fakeEvent.target.files = [file];
        project_file_add_local(fakeEvent);
      }
    });
  }
}

// ==================== S3 UI ====================
/**
 * Modal to prompt user to select files from AIND Anivia S3 bucket.
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
    title: "Load from AWS S3",
    message:
      `<div class='card'>\
        <h4 class='card-header'>\
          <div role='group' class='btn-group'>\
            <button type='button' class='btn btn-outline-secondary' id='btn-s3-reset' disabled>Reset</button>\
            <button type='button' class='btn btn-outline-secondary' id='btn-s3-back' disabled>Back</button>\
          </div>\
          ${S3_BUCKET_NAME}/<span id='s3-prefix'>\
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
                // Display clickable folders or text span for file. Both have the key as data-path
                if (pathIsFolder(data)) {
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
      confirm: { label: 'Load' }
    },
    callback: (result) => {
      if (result) {
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

/**
 * Callback function to draw results from s3list() into the table and update the UI
 * 
 * @param {obj} data - The data from s3List results
 * @param {boolean} complete - Indicates if s3List operation was completed
 */
function s3draw(data, complete) {
  if (complete) {
    resetS3UI()
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
  } else {
    s3Prefix = ''
    resetS3UI()
  }
}

/**
 * Reset S3 explorer UI.
 * Clears DataTable, updates header and default input,
 * and enables/disables reset and back buttons.
 */
function resetS3UI() {
  $('#tb-s3objects').DataTable().clear();
  $('.bootbox-input-text').val(s3Prefix ? [S3_BUCKET_NAME, s3Prefix].join('/') : '');
  $('#s3-prefix').text(s3Prefix);
  $('#btn-s3-reset').prop('disabled', !s3Prefix);
  $('#btn-s3-back').prop('disabled', !s3Prefix);
}

// ==================== UTILITIES ====================
/**
 * Determines whether the given path is a S3 folder.
 * 
 * @param {string} path - The path to check.
 * @returns {boolean} - True if the path is a folder, false otherwise.
 */
function pathIsFolder(path) {
  return path.endsWith('/')
}

/**
 * Logs error and alerts the user with an error message.
 * 
 * @param {string} title - The title of the error.
 * @param {Error} error - The error object.
 */
function logErrorAndAlertUser(title, error) {
  console.error(title, error, error.stack)
  bootbox.alert({
    title: title,
    error: `Error: ${error.message}`
  })
}