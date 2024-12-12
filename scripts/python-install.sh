#!/bin/bash

yes | apt-get install python3
which python3
yes | apt install python3-pip
pip3 install scikit-learn --break-system-packages
pip3 install sklearn --break-system-packages
pip3 install fastparquet --break-system-packages
pip3 install pandas --break-system-packages
