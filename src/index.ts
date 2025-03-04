export interface Env {
  REPO: string;
  GITHUB_APP_CLIENT_ID: string;
  GITHUB_APP_CLIENT_SECRET: string;
}

async function login(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (code === null || state === null) {
    const redirectUri = url.searchParams.get('redirect_uri');
    if (redirectUri) {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_APP_CLIENT_ID}&state=${redirectUri}`,
      );
    }

    const status = 400;

    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const body = JSON.stringify({ error: 'missing parameter \'redirect_uri\'' });

    return new Response(body, { status, headers });
  }

  const getTokenUrl = 'https://github.com/login/oauth/access_token';
  const method = 'POST';

  const headers = new Headers();
  headers.append('Accept', 'application/json');

  const body = new FormData();
  body.append('client_id', env.GITHUB_APP_CLIENT_ID);
  body.append('client_secret', env.GITHUB_APP_CLIENT_SECRET);
  body.append('code', code);

  const res = fetch(getTokenUrl, { method, headers, body });

  if (await res.then((data) => data.status === 200)) {
    const token = await res.then((data) => data.json()).then((data) => data.access_token);
    const redirect = new URL(state);
    redirect.searchParams.append('github_access_token', token);
    return Response.redirect(`${redirect}`);
  }

  return res;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getUserInfo(req: Request, _env: Env): Promise<Response> {
  const url = new URL(req.url);

  const token = url.searchParams.get('github_access_token');
  if (token === null) {
    return new Response(JSON.stringify({ error: 'missing parameter \'github_access_token\'' }), { status: 400 });
  }

  const getUserInfoUrl = 'https://api.github.com/user';

  const method = 'GET';

  const headers = new Headers();
  headers.append('Accept', 'application/vnd.github+json');
  headers.append('User-Agent', 'comments.fullstackjam.com');
  headers.append('X-GitHub-Api-Version', '2022-11-28');
  headers.append('Authorization', `Bearer ${token}`);

  return fetch(getUserInfoUrl, { method, headers });
}

async function getComments(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  const issueId = url.searchParams.get('issue_id');
  if (issueId === null) {
    return new Response(JSON.stringify({ error: 'missing parameter \'issue_id\'' }), { status: 400 });
  }

  const headers = new Headers();
  headers.append('Accept', 'application/vnd.github+json');
  headers.append('User-Agent', 'comments.fullstackjam.com');
  headers.append('X-GitHub-Api-Version', '2022-11-28');

  const token = url.searchParams.get('github_access_token');
  if (token) {
    headers.append('Authorization', `Bearer ${token}`);
  }

  const getIssueInfoUrl = `https://api.github.com/repos/${env.REPO}/issues/${issueId}`;
  const issueInfoResp = await fetch(getIssueInfoUrl, { method: 'GET', headers });

  if (issueInfoResp.status !== 200) {
    return issueInfoResp;
  }

  const commentCnt = await issueInfoResp.json().then((data) => data.comments);
  const pageCnt = Math.ceil(commentCnt / 100);

  const commentPromises = [...Array(pageCnt).keys()].map(async (i) => {
    const getCommentsUrl = `https://api.github.com/repos/${env.REPO}/issues/${issueId}/comments?per_page=100&page=${i + 1}`;
    return fetch(getCommentsUrl, { method: 'GET', headers }).then((data) => data.json());
  });

  const comments = await Promise.all(commentPromises).then((data) => data.flat());
  const body = JSON.stringify(comments);

  return new Response(body, { headers: issueInfoResp.headers });
}

async function postComment(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  const issueId = url.searchParams.get('issue_id');
  if (issueId === null) {
    return new Response(JSON.stringify({ error: 'missing parameter \'issue_id\'' }), { status: 400 });
  }

  const token = url.searchParams.get('github_access_token');
  if (token === null) {
    return new Response(JSON.stringify({ error: 'missing parameter \'github_access_token\'' }), { status: 400 });
  }

  const postCommentUrl = `https://api.github.com/repos/${env.REPO}/issues/${issueId}/comments`;

  const method = 'POST';

  const headers = new Headers();
  headers.append('Accept', 'application/vnd.github+json');
  headers.append('User-Agent', 'comments.fullstackjam.com');
  headers.append('X-GitHub-Api-Version', '2022-11-28');
  headers.append('Authorization', `Bearer ${token}`);

  const { body } = req;

  return fetch(postCommentUrl, { method, headers, body });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { method } = req;
    const path = new URL(req.url).pathname;

    switch (true) {
      case method === 'GET' && path === '/login':
        return login(req, env);

      case method === 'GET' && path === '/userinfo':
        return getUserInfo(req, env);

      case method === 'GET' && path === '/comments':
        return getComments(req, env);

      case method === 'POST' && path === '/comments':
        return postComment(req, env);

      default:
        return new Response(null, { status: 404 });
    }
  },
};
