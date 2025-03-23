export type CursorData = {
	clientx: number;
	clienty: number;
	lat: number;
	lng: number;
};

export const cursor_data = $state<CursorData>({
	clientx: 0,
	clienty: 0,
	lat: 0,
	lng: 0
});
