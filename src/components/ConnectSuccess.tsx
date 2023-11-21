import { useUserQuery } from '@/helpers/api';
import { Icon } from '@iconify/react';

export default function ConnectSuccess({ hasToken }: { hasToken: boolean }) {
	const { isError, data } = useUserQuery(hasToken);

	if (!isError && data?.tasksListId && data.databaseId && data.lastSynced) {
		return (
			<div className="-m-5 mt-12 flex flex-col items-center bg-green-50 p-5">
				<Icon icon="emojione:rocket" className="text-8xl" />
				<div className="text-lg text-gray-600">
					<span className="font-semibold">Hooray!</span> 🚀 You've successfully
					linked Notion and Google Tasks. Enjoy the smooth, real-time
					synchronization and take your productivity to new heights!
				</div>
			</div>
		);
	}

	return null;
}
