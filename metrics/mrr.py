#!/usr/bin/env python3

import pandas as pd
import numpy as np
import sys


def conform(preds, n=100):
    res = []
    for pred in preds:
        if type(pred) == list:
            tmp = np.array(pred)
        elif type(pred) == np.ndarray:
            tmp = pred
        else:
            raise ValueError("Predictions should be a numpy array.")
        if len(tmp) < n:
            res.append(np.hstack([tmp, [""]*(n - tmp.shape[0])]))
        else:
            res.append(tmp[:n])
    return np.vstack(res)


def mrr(preds, gt):
    preds_ = conform(preds.predictions.values)
    target = gt.target.values
    m = (preds_ == target[:, None]).astype(np.float32)
    m2 = np.hstack([m, np.ones(m.shape[0], dtype=np.float32)[:, None]])
    r_index = m2.argmax(axis=1).astype(float)
    r_index[r_index == 100] = np.inf
    return (1/(r_index+1)).mean()


if __name__ == "__main__":
    ans = pd.read_csv(sys.argv[1])
    ans = ans.set_index(ans.user_id)

    user = pd.read_parquet(sys.argv[2])
    user = user.set_index(user.user_id)

    idx = pd.read_csv(sys.argv[3], header=None)
    idx = idx.iloc[:, 0].values

    if ans.loc[idx].shape[0] != user.loc[idx].shape[0]:
        print('Error: missing predictions')
    else:
        res = mrr(user.loc[idx], ans.loc[idx])

        print("ok: {}".format(res))
