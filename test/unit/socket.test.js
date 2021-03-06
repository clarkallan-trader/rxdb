import assert from 'assert';

import * as RxDatabase from '../../dist/lib/index';
import * as Socket from '../../dist/lib/socket';
import * as RxChangeEvent from '../../dist/lib/rx-change-event';
import * as util from '../../dist/lib/util';

describe('socket.test.js', () => {
    it('socket should be able to fetch self-inserted event', async() => {
        const db = await RxDatabase.create({
            name: util.randomCouchString(10),
            adapter: 'memory',
            multiInstance: true
        });
        const socket = db.socket;

        const ok = await socket.write(RxChangeEvent.create('test', db));
        assert.ok(ok);
        const docs = await socket.fetchDocs();
        assert.equal(docs.length, 1);
        assert.equal(docs[0].op, 'test');
        db.destroy();
    });

    it('socket2 should be able to get docs inserted from socket1', async() => {
        const name = util.randomCouchString(10);
        const db = await RxDatabase.create({
            name,
            adapter: 'memory',
            multiInstance: true
        });
        const socket1 = await Socket.create(db);
        const socket2 = await Socket.create(db);

        await socket1.write(RxChangeEvent.create('test', db));
        const docs = await socket2.fetchDocs();

        assert.equal(docs.length, 1);
        assert.equal(docs[0].op, 'test');
        await db.destroy();
        await socket1.destroy();
        await socket2.destroy();
    });

    it('socket-observable should emit changeEvent on pull', async() => {
        const name = util.randomCouchString(10);
        const db = await RxDatabase.create({
            name,
            adapter: 'memory',
            multiInstance: true,
            ignoreDuplicate: true
        });
        const db2 = await RxDatabase.create({
            name,
            adapter: 'memory',
            multiInstance: true,
            ignoreDuplicate: true
        });

        const socket1 = await Socket.create(db);
        const socket2 = await Socket.create(db2);

        const events = [];
        socket2.messages$.subscribe(cE => events.push(cE));

        await socket1.write(RxChangeEvent.create('test', db));
        await socket2.pull();

        assert.equal(events.length, 1);
        assert.equal(events[0].data.op, 'test');

        db.destroy();
        db2.destroy();
        socket1.destroy();
        socket2.destroy();
    });


    it('cleanup should delete old events (takes 5 seconds)', async function() {
        return true; // commented out because this takes soo long
        this.timeout(10 * 1000);
        const db = await RxDatabase.create({
            name: util.randomCouchString(10),
            adapter: 'memory',
            multiInstance: true
        });
        const socket = db.socket;

        // add many events
        await Promise.all(
            util.filledArray(10)
            .map(() => RxChangeEvent
                .create('test' + util.randomCouchString(10), db))
            .map(cE => socket.write(cE))
        );

        await util.promiseWait(Socket.EVENT_TTL);
        await socket.pull();

        const docs = await socket.fetchDocs();
        assert.equal(docs.length, 0);
        db.destroy();
    });

    /*    it('exit', () => {
            process.exit();
        });*/
});
