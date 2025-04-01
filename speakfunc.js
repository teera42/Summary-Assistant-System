import googleTTS from 'google-tts-api';
import { createAudioPlayer, createAudioResource } from '@discordjs/voice';

export async function speak(connection, text) {
    const url = googleTTS.getAudioUrl(text, {
        lang: 'th',
        slow: false,
        host: 'https://translate.google.com',
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(url);

    player.play(resource);
    connection.subscribe(player);
}