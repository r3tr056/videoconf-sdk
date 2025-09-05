import { ConferenceState, STUN_SERVERS, VideoConfContainer } from '../src/components/vidconf_container';

describe('VideoConfContainer', () => {
    let vidconfContainer: VideoConfContainer;
    const mockURL = 'ws://test-video-conf-url';
    const mockContainer = document.createElement('div');

    beforeEach(() => {
        vidconfContainer = new VideoConfContainer(mockURL, {
            container: mockContainer,
            stunServers: STUN_SERVERS,
        });
    });

    test('should initialize VideoConfContainer', () => {
        expect(vidconfContainer).toBeInstanceOf(VideoConfContainer);
    });

    test('should have initial state INVALID', () => {
        expect(vidconfContainer['state']).toBe(ConferenceState.INVALID);
    });

    test('should verify conference URL and set state to VALID_URL', async () => {
        (global as any).verifySocket = jest.fn(() => Promise.resolve());
        await vidconfContainer['verifyConferenceUrl']();
        expect(vidconfContainer['state']).toBe(ConferenceState.VALID_URL);
    });

    test('should fail to verify conference URL and throw error', async () => {
        (global as any).verifySocket = jest.fn(() => Promise.resolve());
        await expect(vidconfContainer['verifyConferenceUrl']()).rejects.toThrow('Invalid URL: Error');
    });

    // test the join meeting functionality
    // test the disconnection functionality
});