#!/usr/bin/env ipython

from flask import Flask, request, send_file
import pandas as pd
import io
from flask_cors import CORS
import tempfile
import json
import shutil

from aniposelib.cameras import CameraGroup
import numpy as np
from collections import defaultdict

app = Flask(__name__)
CORS(app)

# Endpoint to handle CSV to HDF5 conversion
@app.route('/csv_to_h5', methods=['POST'])
def csv_to_h5():
    # Check if a file was uploaded in the request
    if 'file' not in request.files:
        return 'No file uploaded', 400

    file = request.files['file']

    # file.save("test.csv")
    temp_file = tempfile.NamedTemporaryFile(delete=False)
    try:
        file.save(temp_file.name)
    except Exception as e:
        return f'Error saving file to temporary file: {str(e)}', 500

    # Read the CSV file
    try:
        df = pd.read_csv(temp_file.name, header=[0, 1, 2], index_col=0)
    except Exception as e:
        return f'Error reading CSV file: {str(e)}', 400

    # Create a temporary file to write the HDF5 data
    with tempfile.NamedTemporaryFile(suffix='.h5', delete=True) as temp_file:
        df.to_hdf(temp_file.name, key='df_with_missing')

        # Return the HDF5 file as the response
        return send_file(temp_file.name, as_attachment=True)


# Endpoint to handle HDF5 to CSV conversion
@app.route('/h5_to_csv', methods=['POST'])
def h5_to_csv():
    # Check if a file was uploaded in the request
    if 'file' not in request.files:
        return 'No file uploaded', 400

    file = request.files['file']
    print(file)

    temp_file = tempfile.NamedTemporaryFile(delete=False)
    try:
        file.save(temp_file.name)
    except Exception as e:
        return f'Error saving file to temporary file: {str(e)}', 500

    # Read the HDF5 file
    try:
        df = pd.read_hdf(temp_file.name)
    except Exception as e:
        temp_file.close()
        return f'Error reading HDF5 file: {str(e)}', 400
    
    # Delete the temporary file
    temp_file.close()

    if isinstance(df.index, pd.MultiIndex):
        df.index = ['/'.join(x) for x in df.index]

    df.index = [x.replace('\\', '/') for x in df.index]

    # Convert processed data to a CSV file
    try:
        csv_data = df.to_csv(index=True)
    except Exception as e:
        return f'Error converting data to CSV: {str(e)}', 500

    # Return the CSV file as the response
    return csv_data, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment;filename=output.csv'
    }

# Endpoint to handle CSV to HDF5 conversion
@app.route('/recalibrate', methods=['POST'])
def recalibrate():
    # Check if a file was uploaded in the request
    if 'file' not in request.files:
        return 'No file uploaded', 400

    if 'calibration' not in request.form:
        return 'No initial calibration uploaded', 400

    file = request.files['file']

    # file.save("test.csv")
    temp_file = tempfile.NamedTemporaryFile(delete=False)
    try:
        file.save(temp_file.name)
    except Exception as e:
        return f'Error saving file to temporary file: {str(e)}', 500

    # Read the CSV file
    try:
        df = pd.read_csv(temp_file.name, header=[0, 1, 2], index_col=0)
    except Exception as e:
        return f'Error reading CSV file: {str(e)}', 400

    calib_params = json.loads(request.form['calibration'])
    print(calib_params.keys())

    # shutil.copy(temp_file.name, "/home/lili/tmp/calib_pose_2d.csv")
    # with open("/home/lili/tmp/calib_params.json", "w") as f:
    #     json.dump(calib_params, f)

    cams = list(calib_params['cameras'].values())
    cgroup = CameraGroup.from_dicts(cams)

    names = []
    cdict = defaultdict(list)
    for index, row in df.iterrows():
        components = index.split("/")
        camera = components[-2].split("--")[-1]
        name = components[-1]
        pts = row.to_numpy().reshape(-1, 2)
        cdict[(camera, name)] = pts
        names.append(name)

    n_kpts = pts.shape[0]
    n_cams = len(cgroup.cameras)
    n_files = len(np.unique(names))
    all_pts = np.full((n_cams, n_files, n_kpts, 2), np.nan, dtype='float64')

    for nix, name in enumerate(np.unique(names)):
        for cix, cname in enumerate(cgroup.get_names()):
            if (cname, name) in cdict:
                offset = calib_params['cameras'][cname]['offset']
                all_pts[cix, nix] = cdict[(cname, name)] + np.array(offset[:2])

    all_pts_flat = all_pts.reshape(n_cams, -1, 2)

    good = np.sum(np.isfinite(all_pts_flat[:, :, 0]), axis=0) >= 2
    all_pts_flat_sub = all_pts_flat[:, good]

    # cgroup.bundle_adjust_iter(all_pts_flat_sub, verbose=True, error_threshold=5, start_mu=20)
    cgroup.bundle_adjust_iter(all_pts_flat_sub, verbose=True)

    outdict = defaultdict(dict)
    for c in cgroup.get_dicts():
        c = c.copy()
        c['offset'] = calib_params['cameras'][c['name']]['offset']
        outdict['cameras'][c['name']] = c
    outdict['camera_order'] = calib_params['camera_order']

    return json.dumps(outdict), 200,  {
        'Content-Type': 'text/json'
    }


@app.route("/")
def hello():
    return "Hello from h5 converter server!"

if __name__ == '__main__':
    app.run(debug=True, threaded=True)
