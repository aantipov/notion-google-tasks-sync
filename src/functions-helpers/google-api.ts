/**
 * Google API helpers
 * IMPORTANT: This file is to be used by Server Functions only!
 */

import {
	GOOGLE_MAX_TASKS,
	GOOGLE_TOKEN_URI,
	GOOGLE_USERINFO_URL,
	NOTION_RATE_LIMIT,
} from '@/constants';
import type { GTaskT } from '@/helpers/api';
import type { NTaskT } from './notion-api';

export interface GTasksResponseT {
	nextPageToken?: string;
	items: GTaskT[];
}

interface UserInfoResponseT {
	id: string;
	email: string;
	verified_email: boolean;
	picture: string;
}

interface OritinalTokenResponseT {
	access_token: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
	token_type: 'Bearer';
}

export interface GTokenResponseT extends OritinalTokenResponseT {
	user: UserInfoResponseT;
}

export interface GTasksListT {
	id: string;
	title: string;
}

/**
 * Fetch open tasks for initial sync
 */
export async function fetchOpenTasks(
	tasksListId: string,
	token: string,
): Promise<GTasksResponseT> {
	const tasksAPIUrl = new URL(
		`https://tasks.googleapis.com/tasks/v1/lists/${tasksListId}/tasks`,
	);
	tasksAPIUrl.searchParams.set('maxResults', GOOGLE_MAX_TASKS.toString());
	tasksAPIUrl.searchParams.set('showCompleted', 'false');

	const resp = await fetch(tasksAPIUrl.toString(), {
		method: 'GET',
		headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
	});
	if (!resp.ok) {
		const error = new Error(resp.statusText) as any;
		error.code = resp.status;
		throw error;
	}
	return await resp.json();
}

type GTaskIdT = string;
type NTaskIdT = string;
type IdTupleT = [GTaskIdT, NTaskIdT];

export async function createAllGoogleTasks(
	nTasks: NTaskT[],
	gTasksListId: string,
	accessToken: string,
): Promise<IdTupleT[]> {
	const promises = [];
	for (let i = 0; i < nTasks.length; i++) {
		const promise: Promise<IdTupleT> = new Promise((resolveTask) => {
			setTimeout(
				async () => {
					const nTask = nTasks[i];
					const gTask = await createTask(nTask, gTasksListId, accessToken);
					resolveTask([gTask.id, nTask.id]);
				},
				Math.floor(i / NOTION_RATE_LIMIT) * 1000,
			);
		});
		promises.push(promise);
	}
	return Promise.all(promises);
}

async function createTask(
	nTask: NTaskT,
	gTasksListId: string,
	accessToken: string, // access token
): Promise<GTaskT> {
	console.log('Creating Google task', nTask.title);
	try {
		const tasksAPIUrl = new URL(
			`https://tasks.googleapis.com/tasks/v1/lists/${gTasksListId}/tasks`,
		);

		const tasksResp = await fetch(tasksAPIUrl.toString(), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				accept: 'application/json',
			},
			body: JSON.stringify({
				title: nTask.title,
				due: nTask.due?.start ? new Date(nTask.due.start).toISOString() : null,
				status: nTask.status === 'Done' ? 'completed' : 'needsAction',
			}),
		});
		if (!tasksResp.ok) {
			throw new Error(
				`Failed to create a Google task: ${tasksResp.status} ${tasksResp.statusText}`,
			);
		}
		const resp = await tasksResp.json();
		return resp as GTaskT;
	} catch (error) {
		console.error('Error creating a google task', error);
		throw error;
	}
}

async function fetchUserInfo(accessToken: string): Promise<UserInfoResponseT> {
	try {
		const userResp = await fetch(GOOGLE_USERINFO_URL, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				accept: 'application/json',
			},
		});
		if (!userResp.ok) {
			throw new Error(
				`Failed to fetch user info: ${userResp.status} ${userResp.statusText}`,
			);
		}
		const userData = (await userResp.json()) as UserInfoResponseT;
		return userData;
	} catch (error) {
		console.error('Error fetching user info', error);
		throw error;
	}
}

export async function fetchToken(
	authCode: string,
	env: CFEnvT,
): Promise<GTokenResponseT> {
	try {
		const googleTokenUrl = new URL(GOOGLE_TOKEN_URI);
		googleTokenUrl.searchParams.set('code', authCode);
		googleTokenUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
		googleTokenUrl.searchParams.set('client_secret', env.GOOGLE_CLIENT_SECRET);
		googleTokenUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
		googleTokenUrl.searchParams.set('grant_type', 'authorization_code');
		const tokensResp = await fetch(googleTokenUrl.toString(), {
			method: 'POST',
			headers: { accept: 'application/json' },
		});
		if (!tokensResp.ok) {
			throw new Error(
				`Failed to fetch token data: ${tokensResp.status} ${tokensResp.statusText}`,
			);
		}
		// TODO: handle error response
		const tokenData = (await tokensResp.json()) as OritinalTokenResponseT;
		const userData = await fetchUserInfo(tokenData.access_token);

		if (!userData.verified_email) {
			throw new Error('User email not verified');
		}

		return { ...tokenData, user: userData };
	} catch (error) {
		console.error('Error fetching token data', error);
		throw error;
	}
}
