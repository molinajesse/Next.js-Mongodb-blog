import { isEmpty } from "lodash";
import type { NextApiRequest, NextApiResponse } from "next";
import { HttpRequest, ServerInfo } from "../../enums";
import { mongoConnection, ServerError } from "../../lib/server";
import { IPostReq, IResponse } from "../../types";
import {
  forwardResponse,
  handleAPIError,
  handleBadRequest,
  handleRequest,
} from "./middlewares";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  switch (req.method) {
    case HttpRequest.GET:
      return handleGet(req, res);
    case HttpRequest.POST:
      return handleRequest(req, res, createDoc);
    case HttpRequest.PUT:
      return handleRequest(req, res, updateDoc);
    case HttpRequest.DELETE:
      return handleRequest(req, res, deleteDoc);
    default:
      return handleBadRequest(res);
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const reqQuery = req.query as Partial<IPostReq>;
  const { user, slug, count = 1 } = reqQuery;
  if (count > 1) {
    // fetch a few
  } else {
    if (!user || !slug) {
      handleBadRequest(res);
    } else {
      await getDoc(reqQuery)
        .then((payload) => forwardResponse(res, payload))
        .catch((err) => handleAPIError(res, err));
    }
  }
}

async function createDoc(reqBody: Partial<IPostReq>): Promise<IResponse> {
  return new Promise(async (resolve, reject) => {
    const { slug, userId } = reqBody;
    try {
      const { Post } = await mongoConnection();
      await Post.findOne({ slug, userId }).then((existingPost) => {
        if (!isEmpty(existingPost)) {
          resolve({ status: 200, message: ServerInfo.POST_SLUG_TAKEN });
          return;
        }
      });
      await Post.create(reqBody).then((res) => {
        if (!!res.id) {
          resolve({
            status: 200,
            message: ServerInfo.POST_CREATED,
            data: { postId: res.id, post: res },
          });
        } else {
          reject(new ServerError());
        }
      });
    } catch (err) {
      reject(new ServerError(500, err.message));
    }
  });
}

async function getDoc(params: object): Promise<IResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      const { Post } = await mongoConnection();
      await Post.findOne(params).then((post) => {
        if (isEmpty(post)) {
          reject(new ServerError(400, ServerInfo.POST_NA));
        } else {
          resolve({
            status: 200,
            message: ServerInfo.POST_RETRIEVED,
            data: { post },
          });
        }
      });
    } catch (err) {
      reject(new ServerError(500, err.message));
    }
  });
}

async function updateDoc(req: Partial<IPostReq>): Promise<IResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      const { Post } = await mongoConnection();
      const { user, id, update } = req;
      if (update) {
        await Post.updateOne({ user, id }, { $set: req }, (err, _res) => {
          if (err) {
            reject(new ServerError(500, err.message));
          } else {
            resolve({
              status: 200,
              message: ServerInfo.POST_UPDATED,
              data: { ..._res },
            });
          }
        });
      } else {
        await Post.findOne({ user, id }).then((existPost: any) => {
          if (!isEmpty(existPost)) {
            resolve({
              status: 200,
              message: ServerInfo.POST_SLUG_TAKEN,
            });
            return;
          } else {
            // TODO:
          }
        });
      }
    } catch (err) {
      reject(new ServerError(500, err.message));
    }
  });
}

async function deleteDoc(req: Partial<IPostReq>): Promise<IResponse> {
  return new Promise(async (resolve, reject) => {
    const { user, id } = req;
    try {
      const { Post } = await mongoConnection();
      await Post.deleteOne({ user, id }).then((res) => {
        if (res.acknowledged) {
          resolve({ status: 200, message: ServerInfo.POST_DELETED });
        } else {
          reject(new ServerError());
        }
      });
    } catch (err) {
      reject(new ServerError(500, err.message));
    }
  });
}
