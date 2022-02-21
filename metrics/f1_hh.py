#!/usr/bin/env python
from sklearn.metrics import f1_score
import pandas as pd
import numpy as np
import sys

def get_target_array(x):
    if type(x) != str:
        res = np.zeros(9).astype(int)
        res[x] = 1
        return res
    a = list(map(int, x.split(',')))
    res = np.zeros(9).astype(int)
    res[a] = 1
    return res


ans = pd.read_csv(sys.argv[1])
ans = ans.set_index('review_id')
ans['target'] = ans['target'].apply(get_target_array)

user = pd.read_csv(sys.argv[2])
user = user.set_index('review_id')
user['target'] = user['target'].apply(get_target_array)

idx = pd.read_csv(sys.argv[3])
idx = idx.iloc[:, 0].values


if ans.loc[idx].shape[0] != user.loc[idx].shape[0]:
    print('Error: missing review_id')
else:
    res = f1_score(np.vstack(ans.loc[idx]['target']), np.vstack(user.loc[idx]['target']), average='samples')

    print("ok: {}".format(res))
