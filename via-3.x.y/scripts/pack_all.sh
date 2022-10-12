#!/bin/sh
python3 pack.py via image_annotator
python3 pack.py via audio_annotator
python3 pack.py via video_annotator

python3 pack.py demo image_annotator
python3 pack.py demo audio_annotator
python3 pack.py demo video_annotator
python3 pack.py demo pair_annotator

python3 pack_subtitle_annotator.py
