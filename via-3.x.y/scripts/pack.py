#!/usr/bin/env python3

## Pack VIA for distribution.
##
## SYNOPSIS
##
##   pack.py WHAT TARGET
##
## DESCRIPTION
##
##   WHAT can be `via`, `demo`, or `project`.
##
##   TARGET is one of the pages in `src/html` such as
##   `audio_annotator` or `image_annotator`.  If TARGET is `project`,
##   then its value must be one in the `projects` directory.

## Author: Abhishek Dutta <thelinuxmaniac@gmail.com>
## Author: David Miguel Susano Pinto <carandraug+dev@gmail.com>


import argparse
import string
import os
import sys


SCRIPTS_DIR = os.path.dirname(os.path.realpath(__file__))
ROOT_DIR = os.path.join(SCRIPTS_DIR, '..')
SRC_DIR = os.path.join(ROOT_DIR, 'src')
PROJECTS_DIR = os.path.join(ROOT_DIR, 'projects')
DIST_DIR = os.path.join(ROOT_DIR, 'dist')
DATA_DEMO_DIR = os.path.join(ROOT_DIR, 'data', 'demo')


def get_file_contents(fpath):
  with open(fpath) as f:
    return f.read()


def write_file_contents(outf, tag, fpath):
    rel_fpath = os.path.relpath(fpath, start=ROOT_DIR)
    outf.write('<!-- START: Contents of file: ' + rel_fpath + '-->\n')
    outf.write('<' + tag + '>\n')
    outf.write(get_file_contents(fpath))
    outf.write('</' + tag + '>\n')
    outf.write('<!-- END: Contents of file: ' + rel_fpath + '-->\n')


def main(argv):
    if len(argv) != 3:
        print("Usage: python3 pack WHAT TARGET", file=sys.stderr)
        print("e.g.: python3 pack DEMO mri_stenosis_annotator",  file=sys.stderr)
        print("e.g.: python3 pack VIA image_annotator",  file=sys.stderr)
        return 1

    pack_what = argv[1]
    packing_demo = False
    packing_project = False
    if pack_what == "via":
        out_dir = DIST_DIR
    elif pack_what == "project":
        packing_project = True
        out_dir = os.path.join(DIST_DIR, "projects")
    elif pack_what == "demo":
        packing_demo = True
        out_dir = os.path.join(DIST_DIR, "demo")
    else:
        print("Usage: python3 pack WHAT TARGET", file=sys.stderr)
        print("  WHAT needs to be one of 'via', 'demo', or 'project'", file=sys.stderr)
        return 1

    target = argv[2]

    if packing_project:
        target_html = os.path.join(PROJECTS_DIR, target, '_via_' + target + '.html')
    else:
        target_html = os.path.join(SRC_DIR, 'html', '_via_' + target + '.html')

    out_html = os.path.join(out_dir, 'via_' + target + '.html')
    if not os.path.exists(out_dir):
        os.mkdir(out_dir)

    base_href = os.path.dirname(target_html)
    with open(out_html, 'w') as outf, open(target_html, 'r') as inf:
        for line in inf:
            if '<script src="' in line:
                tok = line.split('"')
                filename = tok[1]
                write_file_contents(outf, 'script', os.path.join(base_href, filename))
            elif '<link rel="stylesheet" type="text/css"' in line:
                tok = line.split('"')
                filename = tok[5]
                write_file_contents(outf, 'style', os.path.join(base_href, filename))
            elif packing_demo and "<!-- DEMO SCRIPT AUTOMATICALLY INSERTED BY VIA PACKER SCRIPT -->" in line:
                write_file_contents(outf, 'script', os.path.join(DATA_DEMO_DIR, '_via_' + target + '.js'))
                write_file_contents(outf, 'script', os.path.join(SRC_DIR, 'js', '_via_demo_' + target + '.js'))
            else:
                parsedline = line
                if "//__ENABLED_BY_PACK_SCRIPT__" in line:
                    parsedline = line.replace('//__ENABLED_BY_PACK_SCRIPT__', '');
                if packing_demo and "//__ENABLED_BY_DEMO_PACK_SCRIPT__" in line:
                    parsedline = line.replace('//__ENABLED_BY_DEMO_PACK_SCRIPT__', '');
                outf.write(parsedline)

    print("Written packed file to: " + out_html)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
