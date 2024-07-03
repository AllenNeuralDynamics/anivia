function index_of_min(arr) {
  // adapted from stack overflow
    if (arr.length === 0) {
        return -1;
    }
    var min = arr[0];
    var minIndex = 0;
    for (var i = 1; i < arr.length; i++) {
        if (arr[i] < min) {
            minIndex = i;
            min = arr[i];
        }
    }
    return minIndex;
}

function triangulate_simple(points_und, cam_mats) {
  var A = [];
  for(var i=0; i<cam_mats.length; ++i) {
    let point = points_und[i];
    let mat = cam_mats[i];
    let row_1 = [];
    let row_2 = [];
    for(var j=0; j<4; j++) {
      row_1.push(point[0] * mat[2][j] - mat[0][j]);
      row_2.push(point[1] * mat[2][j] - mat[1][j]);
    }
    A.push(row_1)
    A.push(row_2)
  }

  var {u, v, q} = SVDJS.SVD(A, 'f');

  var min_ix = index_of_min(q);
  var ratio = v[3][min_ix];
  var p3d = [];
  for(var j=0; j<3; j++) {
    p3d.push(v[j][min_ix] / ratio);
  }
  return p3d;
}

function rodrigues_inverse(rotationVector) {
  var theta = Math.sqrt(rotationVector[0] * rotationVector[0] + rotationVector[1] * rotationVector[1] + rotationVector[2] * rotationVector[2]);
  var k = rotationVector.map(function(x) {
    return x / theta;
  });

  var c = Math.cos(theta);
  var s = Math.sin(theta);
  var t = 1 - c;

  var rotationMatrix = [
    [   c + k[0]*k[0]*t,    k[0]*k[1]*t - k[2]*s,  k[0]*k[2]*t + k[1]*s],
    [k[1]*k[0]*t + k[2]*s ,  c + k[1]*k[1]*t,      k[1]*k[2]*t - k[0]*s],
    [k[2]*k[0]*t - k[1]*s,  k[2]*k[1]*t + k[0]*s,     c + k[2]*k[2]*t]
  ];

  return rotationMatrix;
}


function make_M(rvec, tvec) {
  const out = math.zeros(4, 4)._data;

  // Compute the rotation matrix using rodrigues_inverse function
  const rotmat = rodrigues_inverse(rvec);

  // Populate the upper-left 3x3 submatrix with the rotation matrix
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i][j] = rotmat[i][j];
    }
  }

  // Populate the first 3 elements of the last column with tvec
  for (let i = 0; i < 3; i++) {
    out[i][3] = tvec[i];
  }

  // Set the bottom-right element to 1
  out[3][3] = 1;

  return out;
}


function undistort_points(points, cam) {
  const matrix = cam.matrix;
  const dist = cam.distortions;
  const invMatrix = math.inv(matrix);
  // inverse translation
  if(cam.offset) {
    points = math.add(points, cam.offset.slice(0, 2));
  }
  const pts = math.multiply(points, math.subset(invMatrix, math.index([0,1], [0,1])));
  const k = new Array(8).fill(0);
  k.splice(0, dist.length, ...dist);

  const out = [];
  for(var i=0; i<pts.length; i++) {
    let pt = pts[i];
    // inverse translation
    let x0 = pt[0] + invMatrix[0][2];
    let y0 = pt[1] + invMatrix[1][2];
    let x = x0;
    let y = y0;

    const ITERS = 5;
    for (let j = 0; j < ITERS; j++) {
      const r2 = x**2 + y**2;
      const icdist = (1 + ((k[7]*r2 + k[6])*r2 + k[5])) / (1 + ((k[4]*r2 + k[1])*r2 + k[0])*r2);
      const deltaX = 2*k[2]*x*y + k[3]*(r2 + 2*x**2);
      const deltaY = k[2]*(r2 + 2*y**2) + 2*k[3]*x*y;
      x = (x0 - deltaX)*icdist;
      y = (y0 - deltaY)*icdist;
    }
    out.push([x, y]);
  }

  return out;
}

// loop and put it all together
// triangulate a point from raw coordinates

function triangulate_points(points, calib_params) {
  points_und = [];
  cam_mats = [];
  for(var i=0; i<calib_params.camera_order.length; i++) {
    let cname = calib_params.camera_order[i];
    let cam = calib_params.cameras[cname];
    if((points[i] === undefined) || isNaN(points[i][0]) || isNaN(points[i][1])) {
      continue;
    }
    let pt_und = undistort_points([points[i]], cam)
    let ext = make_M(cam.rotation, cam.translation);
    points_und.push(pt_und[0]);
    cam_mats.push(ext);
  }
  var p3d_new;
  if(points_und.length <= 1) {
    p3d_new = [NaN, NaN, NaN]; // not enough information
  } else {
    p3d_new = triangulate_simple(points_und, cam_mats);
  }
  return p3d_new;
}

// project the point back to 2d points
function project_points_cam(point, cam) {
  var R = rodrigues_inverse(cam.rotation);

  const k = new Array(8).fill(0);
  k.splice(0, cam.distortions.length, ...cam.distortions);

  var X = R[0][0] * point[0] + R[0][1] * point[1] + R[0][2] * point[2] + cam.translation[0];
  var Y = R[1][0] * point[0] + R[1][1] * point[1] + R[1][2] * point[2] + cam.translation[1];
  var Z = R[2][0] * point[0] + R[2][1] * point[1] + R[2][2] * point[2] + cam.translation[2];

  var x_proj = X / Z;
  var y_proj = Y / Z;

  // TODO: implement higher order distortions here
  var r2 = x_proj * x_proj + y_proj * y_proj;
  var radialDistortion = 1 + k[0] * r2 + k[1] * r2 * r2 + k[4] * r2 * r2 * r2;
  var x_corrected = x_proj * radialDistortion + 2 * k[2] * x_proj * y_proj + k[3] * (r2 + 2 * x_proj * x_proj);
  var y_corrected = y_proj * radialDistortion + k[2] * (r2 + 2 * y_proj * y_proj) + 2 * k[3] * x_proj * y_proj;

  var x_cam = cam.matrix[0][0] * x_corrected + cam.matrix[0][1] * y_corrected + cam.matrix[0][2] - cam.offset[0];
  var y_cam = cam.matrix[1][0] * x_corrected + cam.matrix[1][1] * y_corrected + cam.matrix[1][2] - cam.offset[1];

  return [x_cam, y_cam];
}

function dist_points(p1, p2) {
  if((p1 == undefined) || (p2 == undefined)) {
    return NaN;
  }
  let ex = p1[0] - p2[0];
  let ey = p1[1] - p2[1];
  return Math.sqrt(ex * ex + ey * ey)
}

function project_points(p3d, calib_params) {
  const points_2d = [];
  for(var i=0; i<calib_params.camera_order.length; i++) {
    let cname = calib_params.camera_order[i];
    let cam = calib_params.cameras[cname];
    let p2d = project_points_cam(p3d, cam);
    points_2d.push(p2d);
  }
  return points_2d;
}
