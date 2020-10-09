window.GenericServiceAPI = class GenericServiceAPI {
	constructor() {

	}

	async setInterval(fun, minutes, ...args) {
		while (true) {
			await new Promise(async resolve => {
				let ret = await fun(...(args.concat([new Date()])));
				if (ret === false) {
					return;
				}
				setTimeout(resolve, minutes * 60 * 1000);
			});
		}
	}

	async replicate(tObj, fieldMap, dField, depth, mins) {
		await this.setInterval(async dt => {
			if (dField) this[dField](dt, ">=");
			fieldMap.filter(m => m.unique).forEach(m => {
				if (!this["_" + m.source + "_set"]) this[m.source](null, "!=");
			});

			(await this.findAll(depth)).forEach(async c => {
				fieldMap.filter(m => m.unique).forEach(m => {
					tObj = tObj[m.target](c[m.source](), "=");
				});

				let tAR = await tObj.findAll();
				console.log("tAR", tAR.length);
				if (!tAR.length) {
					fieldMap.filter(m => m.unique).forEach(m => {
						tObj = tObj[m.target](c[m.source](), "=");
					});
					tAR = [tObj];
				}
				tAR.forEach(async _c => {
					fieldMap.filter(m => !m.unique && !m.targetClass).forEach(m => {
						try {
							_c[m.target](c[m.source]());
						} catch (ex) {
							console.log(m, ex);
						}
					});
					for await (const m of fieldMap.filter(m => !m.unique && m.targetClass)) {
						try {
							_c[m.target]((await new m.targetClass()[m.targetKey](c[m.source]()[m.sourceKey](), "=").sync()));
						} catch (ex) {
							console.log(m, ex);
						}
					}
					await _c.store();
				});
			});
		}, mins);
	}
};