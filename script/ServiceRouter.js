function ServiceRouter() {
	var srURL;

	var Store;

	var CRNL;
	var bPost;
	var bDebug;
	var bCache;
	var bLocal;
	var bAsync;
	var bCacheResult;
	var bShowErrors;
	var nMaxURLLength;
	var preProcessHTML;
	var systemName;

	var fLoadingStart;
	var fLoadingEnd;

	var timeDifference = 0; // this is the time difference between client and server, updated with every call (in ticks)

	var s_ErrorMessages;

	this.buildURL = function (srURL) {
		if (!srURL) {
			this.srURL = this.$_REQUEST('sr');
			if (!this.srURL) {
				if (
					document.URL &&
					(document.URL.indexOf(':10080/nammour.com/') > 0 ||
						document.URL.indexOf('192.168.33.1/nammour.com/') > 0)
				) {
					this.srURL = '../cms/ServiceRouterProxy.php';
				} else if (
					document.URL &&
					document.URL.indexOf(':8888/nammour.com/') > 0
				) {
					this.srURL = '../../method/ServiceRouter.ashx';
				} else {
					this.srURL = '/method/ServiceRouter.ashx';
				}
			}
		} else {
			this.srURL = srURL;
		}
		this.srURL += '?srversion=1';
		if (this.$_REQUEST('gzip')) {
			this.srURL += '&gzip=' + this.$_REQUEST('gzip');
		} else {
			this.srURL += '&gzip=true';
		}
		if (this.bCache) {
			this.srURL += '&cache=' + this.bCache;
		}
		if (!this.$_REQUEST('rand', this.srURL)) {
			this.srURL += '&rand=' + Math.random();
		}

		if (this.bDebug) {
			this.srURL += '&DEBUG=true';
		}

		if (
			this.bAsync &&
			this.bLocal &&
			!this.$_REQUEST('async', this.srURL)
		) {
			this.srURL += '&async=true';
			if (this.runAfter) {
				this.srURL += '&runafter=' + this.runAfter;
			}
			this.bAsync = false;
		}

		this.ShowDebug('this.srURL=' + this.srURL);

		return this.srURL;
	};

	this.init = function (
		srURL,
		systemName,
		bPost,
		bDebug,
		bShowErrors,
		preProcessHTML
	) {
		if (typeof document === 'undefined') {
			document = {};
			window = {};
		}
		if (!bDebug && document.URL && document.URL.indexOf('debug=true') > 0)
			bDebug = true;

		this.bLocal = !this.Store &&
			document.URL &&
			!(document.URL.indexOf('local=false') >= 0);
		if (!document.URL) this.bLocal = true;

		this.bCache = this.$_REQUEST('cache');
		this.bCacheResult = this.$_REQUEST('cacheResult');

		this.srURL = this.buildURL(srURL);

		this.CRNL = '\n';
		this.nMaxURLLength = 100;

		this.systemName = systemName;

		this.bPost = bPost;
		this.bDebug = bDebug;
		this.bShowErrors = bShowErrors;

		this.s_ErrorMessages = '';

		return this;
	};

	this.preProcessHTML = function (html) {
		if (!html) return html;

		try {
			var ret = '';
			var parts = html.split('$$');
			for (var i = 0; i < parts.length; i++) {
				if (i % 2 == 0) {
					ret += parts[i];
					continue;
				}
				try {
					var oValue = this.runScript(parts[i]);
					if (oValue) {
						ret += oValue;
					} else {
						ret += '';
					}
				} catch (e) {
					ret += '';
				}
			}

			if (preProcessHTML != null) ret = preProcessHTML(ret);
			return ret;
		} catch (e) {
			return '';
		}
	};

	this.$_REQUEST = function (key, url) {
		url = url || (window.location && window.location.href);
		if (!url) return null;

		var ret = null;
		try {
			ret = new URL(url).searchParams.get(key);
		} catch (ex) {
			var regex = new RegExp('[\\?|&]' + key + '=([^&#]*)');
			var results = regex.exec('?' + url.split('?')[1]);
			ret =
				results === null ?
				'' :
				decodeURIComponent(results[1].replace(/\+/g, ' '));
		}
		return ret === null ? '' : ret;
	};

	this.groupBy = function (ar, field) {
		if (!ar || !field) return null;

		fields = field.split('.');

		var keys = [];
		for (var i = 0; i < ar.length; i++) {
			var key = null;
			for (
				var f = 0; f < fields.length; key = (key || ar[i])[fields[f++]]
			);
			try {
				keys[
					(() => {
						for (var k = 0; k < keys.length; k++) {
							if (this.Equals(keys[k].key, key)) {
								return k;
							}
						}
						return -1;
					})()
				].values.push(ar[i]);
			} catch {
				keys.push({
					key: key,
					values: [ar[i]],
				});
			}
		}
		return keys;
	};

	this.compile = function (arModules) {
		var calls = [];
		$.each(arModules, (i, m) =>
			calls.push(
				sr._('ContentManager.cmsHTMLPageFindall', null, {
					Page: m,
				})
			)
		);
		return $.when(...calls).then((...arRet) => {
			var _ret = [];
			$.map(arRet, (p) => {
				ret.push(_.template(p.HTML)(sr.runScript(p[0].Script)));
			});
			return _ret;
		});
	};

	this.import = async function (arModules) {
		var ret = [];
		for (var i = 0; i < arModules.length; i++) {
			let p = await this._('ContentManager.cmsHTMLPageFind', null, {
				Page: arModules[i],
			});
			ret.push(p);
			await this.runScript(p.Script);
		}
		return ret;
	};

	this.getObject = function (s) {
		var code = s + ';';
		code = '(typeof ' + s + " === 'undefined')?sr.newObject():" + s;
		//return this.runScript(s+";");
		return this.runScript(code);
	};

	this.runScript = function (s) {
		if (!s) return null;
		try {
			if (window._content && window._content.eval) {
				var output = window._content.eval(s);
				return output;
			}
		} catch (e) {
			this.ShowError('FF SCRIPT: \n' + e.message + '\n' + s);
		}
		try {
			if (window.execScript) {
				if (s.indexOf('\r\n') > 0) {
					// a multi-line statement
					window.execScript(s);
					return null;
				} else {
					// a single-line statement
					newV = null;
					var newS = 'newV = ' + s;
					window.execScript(newS);
					return newV;
				}
			}
		} catch (e) {
			this.ShowError('IE6 SCRIPT: \n' + e.message + '\n' + s);
		}

		try {
			if (window.execScript) {
				if (s.indexOf('\r\n') > 0) {
					// a multi-line statement
					window.execScript(s);
					return null;
				} else {
					// a single-line statement
					newV = null;
					var newS = 'newV = ' + s;
					eval(newS);
					return newV;
				}
			}
		} catch (e) {
			this.ShowError('IE7 SCRIPT: \n' + e.message + '\n' + s);
		}

		try {
			var fn = function () {
				var ret = window.eval.call(window, s);
				return ret;
			};

			return fn();
		} catch (e) {
			this.ShowError('TAG SCRIPT: \n' + e.message + '\n' + s);
		}
	};

	this.ShowObject = function (o, bIgnoreDebug) {
		var ret = 'Object Structure:\n';
		for (s in o) {
			try {
				ret += s + ': ' + o[s] + '\n';
			} catch (e) {
				ret += s + ': Exception with value = ' + e.message + '\n';
			}
		}

		this.ShowDebug(ret, bIgnoreDebug);
	};

	this.ShowError = function (s) {
		console.log(s);
		if (this.bShowErrors) this.ShowMessage(s);
	};

	this.ccopy = function (s) {
		if (window.clipboardData) clipboardData.setData('Text', s);
	};

	this.ShowMessage = function (s) {
		if (typeof noty !== 'undefined') {
			noty({
				text: s,
				type: 'success',
				timeout: 2000,
			});
		} else {
			// the default
			try {
				$("<div title='Information'><p>" + s + '</p></div>').dialog();
			} catch (e) {
				console.log(s);
			}
		}
	};

	this.ShowDebug = function (s, bIgnoreDebug) {
		if (this.bDebug || bIgnoreDebug) this.ShowMessage(s);
	};

	this.param = function (args) {
		var ret =
			'/*' +
			this.CRNL +
			'<![CDATA[' +
			this.CRNL +
			'PARAMETERS' +
			this.CRNL +
			']]>' +
			this.CRNL +
			'*/' +
			this.CRNL +
			this.CRNL +
			'<p>' +
			this.CRNL;
		for (var i = 0; i < args.length; i++) {
			var xml = this._toXML(args[i]);
			if (false) {
				// xml contains characters that would not arrive properly and should be converted to base64
				xml = btoa(xml);
			}
			ret += '<p' + i + '>' + this.CRNL + xml + '' + this.CRNL;
			ret += '</p' + i + '>' + this.CRNL;
		}
		ret += '</p>' + this.CRNL;
		return ret;
	};

	this.resetCursor = function () {
		if (!document.body) return;
		document.body.style.cursor = 'arrow';
		document.body.style.cursor = '';
	};

	this.serverDate = function () {
		return this.addMSeconds(new Date(), -this.timeDifference);
	};

	this.runSRScript = function (s) {
		return this.runScript(
			'(() => { var ret = null; ' +
			s +
			' window.method_name = method_name; window.server_time = server_time; window._exception = typeof(_exception)==="undefined"?null:_exception; window.execution_time = execution_time; return {_exception: _exception, method_name: method_name, server_time: server_time, execution_time: execution_time, ret: ret};})();'
		);
	};

	this.processResult = async function (res) {
		if (!res || !res.Code || !res.StoredMethod) {
			this.ActiveRequest = null;
			return res;
		}

		// for sure a method result from an async call
		if (res.Result) {
			// we got a result
			var __ret = null;
			try {
				__ret = this.processResponse(4, null, res.Result, null);
			} catch (e) {
				__ret = res.Result;
			}
			this.ActiveRequest = null;
			return __ret;
		}

		var timeout = res.RunAfter - res.Date;
		if (timeout <= 0) {
			// negative timeout means that it was supposed to be run but did not for some reason (delay, failure, etc...)
			// same date as runafter means that we are using the immediate async execution. i.e. there is no need for the runner thread task
			timeout = 30000;
		} else if (timeout > 5 * 60 * 1000) {
			// more than we can wait, we return a reference to the result
			console.log(
				'We cannot wait ' +
				Math.floor(timeout / 1000) +
				' seconds. Returning result.'
			);
			return res;
		}
		console.log(
			'Making the next call in ' +
			Math.floor(timeout / 1000) +
			' seconds.'
		);

		await new Promise((resolve) => setTimeout(resolve, timeout));
		if (!this.ActiveRequest) {
			console.log('No ActiveRequest, exiting...');
			return null;
		}
		try {
			let ret = await $.ajax({
				url: '/method/a.ashx?name=ContentManager.cmsMethodResultFind&p0={Code}' +
					res.Code +
					'{/Code}{Id}' +
					res.Id +
					'{/Id}&rand=' +
					Math.random(),
			});
			ret = this.processResponse(4, null, ret, this.ActiveRequest.URL);
			ret = await this.processResult(ret);
			return ret;
		} catch (ex) {
			console.log('processResult', ex);
			return await this._('ContentManager.cmsMethodResultFind', null, {
				Code: res.Code,
				Id: res.Id,
			});
		}
	};

	this.processResponse = function (readyState, callBack, responseText, url) {
		if ([4, 44].indexOf(readyState) == -1) return;

		var sMethodName = this.$_REQUEST('name', url);

		try {
			if (readyState == 4) {
				let res = (async () => {
					return await this.cacheResult(null, responseText);
				})();
			}

			ret = null;
			server_time = null;
			_exception = null;
			this.ShowDebug('Response From Server:\n' + responseText);
			var bScriptError = false;
			var _ret = null;
			try {
				_ret = this.runSRScript(responseText);
			} catch (e) {
				bScriptError = true;
			}

			if (_ret.server_time)
				this.timeDifference =
				new Date().getTime() - _ret.server_time.getTime();

			if (_ret._exception) {
				this.ShowDebug(_exception.Message);
			}

			if (callBack != null) {
				var callRet = null;
				try {
					callRet = callBack(_ret.ret, _ret._exception);
				} catch (e) {
					this.ShowError(
						'Error in Callback:\n\n' + callBack + '\n\n' + e.message
					);
				}
				if (
					typeof _ret.method_name !== 'undefined' &&
					typeof sMethodName !== 'undefined' &&
					sMethodName != _ret.method_name
				) {
					this.ShowError(
						'Mismatch in Method between server and client:\nServer Method Name: ' +
						_ret.method_name +
						'\nClient Method Name: ' +
						sMethodName
					);
				}
				(
					this.fLoadingEnd ||
					function () {
						window.sr.resetCursor();
					}
				)();

				return (
					callRet || _ret.ret || (bScriptError ? responseText : null)
				);
			} else {
				this.resetCursor();
				return _ret.ret || (bScriptError ? responseText : null);
			}
		} catch (e) {
			this.resetCursor();
			this.ShowError('Error in code: ' + e.message + '\n' + responseText);
		}

		return null;
	};

	this.isObject = function (o) {
		return (
			o != null &&
			typeof o == 'object' &&
			!(o.constructor.toString().indexOf('function Date()') > -1) &&
			!(o.constructor.toString().indexOf('Array()') > -1)
		);
	};

	this._toJS = function (o) {
		if (o == null) return 'null';

		var s = '';
		switch (typeof o) {
		case 'string':
			s +=
				'"' +
				this.myReplace(
					this.escapeString(o),
					['": ,'],
					['": null,']
				) +
				'"';
			break;
		case 'number':
			s += o;
			break;
		case 'boolean':
			s += o ? 'true' : 'false';
			break;
		case 'object':
			// Date
			if (o.constructor.toString().indexOf('function Date()') > -1) {
				var year = o.getFullYear().toString();
				//var month = (o.getMonth() + 1).toString(); month = (month.length == 1) ? "0" + month : month;
				var month = o.getMonth().toString();
				month = month.length == 1 ? '0' + month : month;
				var date = o.getDate().toString();
				date = date.length == 1 ? '0' + date : date;
				var hours = o.getHours().toString();
				hours = hours.length == 1 ? '0' + hours : hours;
				var minutes = o.getMinutes().toString();
				minutes = minutes.length == 1 ? '0' + minutes : minutes;
				var seconds = o.getSeconds().toString();
				seconds = seconds.length == 1 ? '0' + seconds : seconds;
				var milliseconds = o.getMilliseconds().toString();
				var tzminutes = Math.abs(o.getTimezoneOffset());
				var tzhours = 0;
				while (tzminutes >= 60) {
					tzhours++;
					tzminutes -= 60;
				}
				tzminutes =
					tzminutes.toString().length == 1 ?
					'0' + tzminutes.toString() :
					tzminutes.toString();
				tzhours =
					tzhours.toString().length == 1 ?
					'0' + tzhours.toString() :
					tzhours.toString();
				var timezone =
					(o.getTimezoneOffset() < 0 ? '+' : '-') +
					tzhours +
					':' +
					tzminutes;
				s +=
					'new Date(' +
					year +
					',' +
					month +
					',' +
					date +
					',' +
					hours +
					',' +
					minutes +
					',' +
					seconds +
					',' +
					milliseconds +
					')';
			}
			// Array
			else if (o.constructor.toString().indexOf('Array()') > -1) {
				s += '[';
				for (var p in o) {
					s += '';
					if (!isNaN(p)) {
						// linear array
						s += this._toJS(o[p]);
					} else {
						// associative array
						s += '{"' + p + '": ' + this._toJS(o[p]) + '}';
					}
					s += ', ';
				}
				s += ']';
			}
			// Object or custom function
			else {
				s += '{';
				for (var p in o) {
					s += '"' + p + '": ' + this._toJS(o[p]) + ', ';
				}
				if (s.lastIndexOf(', ') == s.length - 2)
					s = s.substring(0, s.length - 2);
				s += '}';
			}
			break;
		case 'function':
			// functions are not working, ILLEGAL TOKEN....
			//s += "\""+this.escapeString(o.toString())+"\"";
			s += 'null';
			break;
		default:
			s += 'null';
		}
		return s;
	};

	this.escapeString = function (text) {
		if (!arguments.callee.sRE) {
			var specials = [
				'\r',
				'\n',
				'\f',
				'\b',
				'\t',
				"'",
				'&',
				'/',
				'.',
				'*',
				'+',
				'?',
				'|',
				'(',
				')',
				'[',
				']',
				'{',
				'}',
				'\\',
				'"',
			];
			arguments.callee.sRE = new RegExp(
				'(\\' + specials.join('|\\') + ')',
				'g'
			);
		}
		var ret = text.replace(arguments.callee.sRE, '\\$1');

		ret = this.myReplace(ret, ['<', '>'], ['&lt;', '&gt;']);
		ret = this.myReplace(
			ret,
			['\r', '\n', '\t'],
			['\\' + 'r', '\\' + 'n', '\\' + 't']
		);

		return ret;
	};

	this._toXML = function (o, level) {
		if (!level) level = 0;
		var s = '';
		if (o == null) return s;
		switch (typeof o) {
		case 'string':
			if (
				o.match(
					/^([A-Za-z0-9+\/]{4})*([A-Za-z0-9+\/]{3}=|[A-Za-z0-9+\/]{2}==)?$/g
				)
			) {
				// already a base64, send as is
				s += o;
			} else {
				s += '<![CDATA[' + o + ']]>';
			}

			break;
		case 'number':
		case 'boolean':
			s += o.toString();
			break;
		case 'object':
			// Date
			if (
				o.constructor &&
				o.constructor.toString().indexOf('function Date()') > -1
			) {
				var year = o.getFullYear().toString();
				var month = (o.getMonth() + 1).toString();
				month = month.length == 1 ? '0' + month : month;
				var date = o.getDate().toString();
				date = date.length == 1 ? '0' + date : date;
				var hours = o.getHours().toString();
				hours = hours.length == 1 ? '0' + hours : hours;
				var minutes = o.getMinutes().toString();
				minutes = minutes.length == 1 ? '0' + minutes : minutes;
				var seconds = o.getSeconds().toString();
				seconds = seconds.length == 1 ? '0' + seconds : seconds;
				var milliseconds = o.getMilliseconds().toString();
				var tzminutes = Math.abs(o.getTimezoneOffset());
				var tzhours = 0;
				while (tzminutes >= 60) {
					tzhours++;
					tzminutes -= 60;
				}
				tzminutes =
					tzminutes.toString().length == 1 ?
					'0' + tzminutes.toString() :
					tzminutes.toString();
				tzhours =
					tzhours.toString().length == 1 ?
					'0' + tzhours.toString() :
					tzhours.toString();
				var timezone =
					(o.getTimezoneOffset() < 0 ? '+' : '-') +
					tzhours +
					':' +
					tzminutes;
				//s += year + "-" + month + "-" + date + "T" + hours + ":" + minutes + ":" + seconds + "." + milliseconds + timezone;
				s +=
					month +
					'/' +
					date +
					'/' +
					year +
					' ' +
					hours +
					':' +
					minutes +
					':' +
					seconds;
			}
			// Array
			else if (
				o.constructor &&
				o.constructor.toString().indexOf('Array()') > -1
			) {
				for (var p in o) {
					if (p == 'OPERATORS' || p == 'ORS') continue;
					s += '<Object>';
					if (!isNaN(p)) {
						// linear array
						if (o[p] == null) {
							// null entry in the array
							s += '<Id>0</Id>';
						} else {
							/function\s+(\w*)\s*\(/gi.exec(
								o[p].constructor.toString()
							);
							var type = RegExp.$1;
							switch (type) {
							case '':
								type = typeof o[p];
							case 'String':
								type = 'string';
								break;
							case 'Number':
								type = 'int';
								break;
							case 'Boolean':
								type = 'bool';
								break;
							case 'Date':
								type = 'DateTime';
								break;
							}
							s += this._toXML(o[p], level++);
						}
					} else {
						// associative array
						s +=
							'<' +
							p +
							this.coop(o, p) +
							'>' +
							this._toXML(o[p], level++) +
							'</' +
							p +
							'>';
					}
					s += '</Object>' + this.CRNL;
				}
			}
			// Object or custom function
			else {
				if (o == null || o.Id == 0) {} else if (false && o.Id) {
					// this is creating a problem, better send all the object
					// do not send other data if we have a value for the Id
					s += '<Id>' + this._toXML(o.Id, level++) + '</Id>';
				} else {
					for (var p in o) {
						if (p == 'OPERATORS' || p == 'ORS') continue;
						s +=
							'<' +
							p +
							this.coop(o, p) +
							this.OR(o, p) +
							'>' +
							this._toXML(o[p], level++) +
							'</' +
							p +
							'>';
					}
				}
			}
			break;
		}
		return s;
	};

	this.OR = function (o, p) {
		return o.ORS && o.ORS[p] ?
			" OR='" +
			this.myReplace(o.ORS[p], ['<', '>'], ['&lt;', '&gt;']) +
			"'" :
			'';
	};

	this.coop = function (o, p) {
		if (!o.OPERATORS || !o.OPERATORS[p]) {
			return '';
		}
		return (
			" coop='" +
			this.myReplace(o.OPERATORS[p], ['<', '>'], ['&lt;', '&gt;']) +
			"'"
		);
	};

	this.getXmlHTTP = function () {
		var x = null;
		var activexmodes = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP']; //activeX versions to check for in IE
		if (window.ActiveXObject) {
			//Test for support for ActiveXObject in IE first (as XMLHttpRequest in IE7 is broken)
			for (var i = 0; i < activexmodes.length; i++) {
				try {
					x = new ActiveXObject(activexmodes[i]);
					break;
				} catch (e) {
					//suppress error
				}
			}
		} else if (window.XMLHttpRequest) {
			// if Mozilla, Safari etc
			x = new XMLHttpRequest();
		} else {
			x = null;
		}

		return (window.xmlHTTP = x);
	};

	this.cacheResult = async function (request, textresponse) {
		if (!this.bCacheResult) return;
		request = request || this.ActiveRequest;

		if (!request) {
			return;
		}

		if (
			textresponse &&
			textresponse.indexOf('ret.Code = ') > -1 &&
			textresponse.indexOf('ret.RunAfter = ') > -1 &&
			textresponse.indexOf('ret.Result = ""') > -1
		) {
			console.log('textresponse contians incomplete method result');
			return null;
		}

		var sMethod = this.$_REQUEST('name', request.URL);
		sMethod = sMethod.substring(sMethod.lastIndexOf('.') + 1);
		try {
			var _usable = (r) => {
				var item =
					r &&
					r.hash == request.hash &&
					r.URL == request.URL &&
					r.TextResponse &&
					(typeof r.Expires === 'undefined' ||
						new Date(r.Expires) > new Date()) ?
					r :
					null;
				if (textresponse) {
					item = item || request;
					item.TextResponse = textresponse;
					item.Expires = new Date(
						new Date().getTime() +
						parseFloat(
							this.nCacheExpireHours || this.$_REQUEST('nCacheExpireHours') || 1
						) *
						60 *
						60 *
						1000
					);
				}

				return item;
			};

			if (
				this.bCacheResult == 'kvstore' &&
				typeof window.company.restiodbSettings !== 'undefined'
			) {
				var ajax = (key, value, id) => {
					var ret = company.restiodbSettings();
					ret.url += 'kvstore';
					if (value) {
						if (id) {
							// update record
							ret.url += '/' + id;
							ret.method = 'PUT';
						} else {
							// new record
							ret.method = 'POST';
						}
						ret.data = JSON.stringify({
							key: key,
							value: JSON.stringify(value, null, 4),
						});
					} else {
						if (id) {
							// delete record
							ret.url += '/' + id;
							ret.method = 'DELETE';
						} else {
							ret.method = 'GET';
							ret.url += '?q={"key":' + key + '}';
						}
					}
					console.log('method', ret.method);
					return ret;
				};
				let record = await $.ajax(ajax(request.hash));
				r =
					record && record.length ?
					JSON.parse(record[0].value) :
					null;
				var item = _usable(r);

				if (!item) {
					if (r) {
						await $.ajax(ajax(request.hash, null, record[0]._id));
					}
					return null;
				}

				if (!r || item.Expires > r.Expires) {
					await $.ajax(
						ajax(item.hash, item, r ? record[0]._id : null)
					);
					return item;
				}

				return item;
			} else if (this.bCacheResult == 'sr') {
				var ajax = (key, value, id) => {
					var method = 'Find';
					var ret = {
						url: '/method/a.ashx?name=ContentManager.cmsMethodResult',
						processData: false,
						type: 'POST',
					};
					if (value) {
						if (id) {
							// update record
							method = 'Update';
						} else {
							// new record
							method = 'Insert';
						}
						ret.beforeSend = (request) => {
							request.setRequestHeader(
								'Content-Type',
								'multipart/form-data; boundary=--------------'
							);
						};
					} else {
						ret.type = 'GET';
						if (id) {
							// delete record
							method = 'Delete';
						} else {
							// get record
							method = 'Find';
						}
						method +=
							'&p0={Code}' +
							(company ? company.Code + '-' : '') +
							key +
							'{/Code}';
					}
					ret.url += method;
					if (ret.type != 'GET') {
						delete item.PostData;
						var p0 = {
							Code: (company ? company.Code + '-' : '') + key,
							Completed: new Date(),
							Date: this.ActiveRequest ?
								this.ActiveRequest.Date : new Date(),
							Result: item.TextResponse,
							StoredMethod: {
								Name: sMethod,
							},
						};
						if (id) {
							p0.Id = id;
						}
						ret.data =
							'POSTDATA=\r\n' /*+ "<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\"?>\r\n"*/ +
							this.param([p0]);
					}
					return ret;
				};

				try {
					record = this.runScript(
						'(() => { var ret = null; ' +
						(await $.ajax(ajax(request.hash))) +
						'return ret;})();'
					);
					r = record ? JSON.parse(record.Result) : null;
					var item = _usable(r);
				} catch (ex) {}

				if (!item) {
					if (r) {
						try {
							await $.ajax(ajax(request.hash, null, record.Id));
						} catch (ex) {}
					}
					return null;
				}

				if (!r || item.Expires > r.Expires) {
					await $.ajax(
						ajax(item.hash, item, r && record ? record.Id : null)
					);
					return item;
				}

				return item;
			} else if (this.bCacheResult == 'github') {
				if (request.URL.indexOf('cmsMethodResult') >= 0) return null;
				let res = null;
				try {
					res = await $.ajax({
						url: 'https://arzhospital.github.io/' +
							company.Store +
							'/' +
							request.hash +
							'.js',
						dataType: 'jsonp',
						processResult: false,
					});
					return {
						TextResponse: res,
					};
				} catch (ex) {
					console.log('ERRORS:', ex);
					return null;
				}
			} else if (this.bCacheResult == 'local') {
				var srCache = localStorage.getItem('srCache');
				if (srCache == null) {
					srCache = {
						Requests: {},
					};
				} else {
					srCache = JSON.parse(srCache);
				}

				var r = srCache.Requests[request.hash];
				var item = _usable(r);

				if (!item) {
					delete srCache.Requests[request.hash];
					localStorage.setItem('srCache', JSON.stringify(srCache));
					return null;
				}

				if (!r || item.Expires > r.Expires) {
					srCache.Requests[item.hash] = item;
					localStorage.setItem('srCache', JSON.stringify(srCache));
					return item;
				}

				return item;
			}
		} catch (ex) {
			console.log(ex);
			throw ex;
		}
	};

	this._ = async function (fun, callBack) {
		if (this.s_ErrorMessages.length > 0) {
			alert(
				'The following errors were found in your data:\n' +
				this.s_ErrorMessages
			);
			this.s_ErrorMessages = '';
			return null;
		}

		this.buildURL();

		//var postData = "System.Collections.ArrayList ret = new System.Collections.ArrayList();"+this.CRNL;
		(
			this.fLoadingStart ||
			function () {
				if (document.body) document.body.style.cursor = 'wait';
			}
		)();

		var args = Array();
		for (var i = 2; i < arguments.length; i++) {
			args[i - 2] = arguments[i];
		}

		var postData = this.param(args);
		if (fun.indexOf('.') < 0) {
			fun = this.systemName + '.' + fun;
		} else if (fun.indexOf('.') == 0) {
			// a non-layer method
			fun = fun.substring(1);
		}

		if (callBack && this.ActiveRequest) {
			this.ActiveRequest = null;
			//return false;
		}

		var hCode = this.hashCode(
			fun.substring(fun.indexOf('.') + 1) + postData
		);
		postData +=
			this.CRNL +
			this.CRNL +
			'<!--<pid>' +
			hCode +
			'</pid>-->' +
			this.CRNL;

		if (fun.indexOf('cmsMethodResultFind') < 0) {
			// avoid overwrite of async calls
			this.ActiveRequest = {
				URL: this.srURL + '&name=' + fun,
				PostData: postData,
				Date: new Date(),
				CallBack: callBack,
				Company: typeof company !== 'undefined' && company ? {
					Code: company.Code,
				} : null,
				TextResponse: null,
				hash: hCode,
			};
		}

		if (!this.bLocal) {
			// live
			try {
				var _theUrl =
					(this.Store ||
						'/store/' +
						(window.company && window.company.Code ?
							window.company.Code + '/' :
							'/')) +
					hCode +
					'.js?rand=' +
					Math.random();
				let request = await this.cacheResult();
				var responseText = null;
				if (!request) {
					try {
						responseText = await $.get(_theUrl);
					} catch (ex) {}
				} else {
					responseText = request.TextResponse;
				}
				if (!responseText) {
					console.log(
						'Live Mode, no response text for ' +
						this.ActiveRequest.hash +
						' - ' +
						this.$_REQUEST('name', this.ActiveRequest.URL)
					);
					return null;
				}

				var _ret = null;
				var _exception = null;
				try {
					_ret = this.runSRScript(responseText);
					_exception = _ret._exception;
					if (_ret.server_time) {
						this.timeDifference =
							new Date().getTime() - _ret.server_time.getTime();
					}
				} catch (e) {
					_exception = e;
				}

				if (!_ret && !_exception) {
					return await null; //this.doHeadlessCall(callBack);
				} else {
					//this.ActiveRequest = null;
					if (callBack != null) {
						try {
							callBack(
								_ret.ret || (_exception ? responseText : null),
								_exception
							);
						} catch (e) {
							this.ShowError(
								'Error in Callback:\n\n' +
								callBack +
								'\n\n' +
								e.message
							);
						}
					}
					(
						window.sr.fLoadingEnd ||
						(() => {
							this.resetCursor();
						})
					)();
					return (
						(_ret ? _ret.ret : null) ||
						(_exception ? responseText : null)
					);
				}
			} catch (e) {
				console.log(e);
				return false;
			}
		} else {
			return (async () => {
				return await this.sendXML(
					this.srURL + '&name=' + fun,
					postData,
					callBack
				);
			})();
		}
	};

	this.promise = function (data, callBack) {
		if (!callBack || {}.toString.call(callBack) !== '[object Function]') {
			return data;
		}

		var p = $.Deferred();

		setTimeout(async () => {
			try {
				let d = await callBack(data);
				p.resolve(d);
			} catch (ex) {
				try {
					p.resolve(callBack(data));
				} catch (_ex) {
					console.log('promise exception', _ex);
				}
			}
		}, 500);

		return p ? p.promise() : data;
	};

	this.sendXML = async function (url, postData, callBack) {
		if (!window.SR) window.SR = this;

		if (window.jQuery) {
			let request = await this.cacheResult(null, null, callBack);
			if (request) {
				let result = await this.processResponse(
					44,
					callBack,
					request.TextResponse,
					url
				);
				return await this.processResult(result);
			} else {
				// jquery call
				var ajax = {};
				if (this.bPost || postData.length > nMaxURLLength) {
					ajax.url = url;
					ajax.type = 'POST';
					ajax.beforeSend = (request) => {
						request.setRequestHeader(
							'Content-Type',
							'multipart/form-data; boundary=--------------'
						);
					};
					ajax.data =
						'POSTDATA=\r\n' /*+ "<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\"?>\r\n"*/ +
						postData;
				} else {
					ajax.url = url + '&POSTCODE=' + this.toHex(postData);
					ajax.type = 'GET';
				}
				return (async () => {
					let ret = await $.ajax(ajax);
					ret = await this.processResult(
						this.processResponse(4, callBack, ret, url)
					);
					return ret;
				})();
			}
		} else {
			var xmlHTTP = this.getXmlHTTP();
			if (!xmlHTTP) return false;
			if (callBack != null) {
				window.xmlHTTP.onreadystatechange = function () {
					if (window.xmlHTTP.readyState == 4) {
						if ($.when) {
							$.when(
								window.SR.processResponse(
									window.xmlHTTP.readyState,
									callBack,
									window.xmlHTTP.responseText,
									url
								)
							).then((result) => window.SR.processResult(result));
						} else {
							window.SR.processResult(
								window.SR.processResponse(
									window.xmlHTTP.readyState,
									callBack,
									window.xmlHTTP.responseText,
									url
								)
							);
						}
					}
				};
			}

			if (this.bPost || postData.length > nMaxURLLength) {
				window.xmlHTTP.open('POST', url, callBack != null);
				window.xmlHTTP.setRequestHeader(
					'Content-Type',
					'multipart/form-data; boundary=--------------'
				); // fool cross-domain checking in chrome
				window.xmlHTTP.send(
					'POSTDATA=\r\n' /*+ "<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\"?>\r\n"*/ +
					postData
				);
			} else {
				xmlHTTP.open(
					'GET',
					url + '&POSTCODE=' + this.toHex(postData),
					callBack != null
				);
				xmlHTTP.send(null);
			}

			if (callBack == null && xmlHTTP.readyState == 4) {
				var _url = url + '&POSTCODE=' + this.toHex(postData);
				if ($.when) {
					return $.when(
						this.processResponse(
							xmlHTTP.readyState,
							callBack,
							xmlHTTP.responseText,
							_url
						)
					).then((result) => {
						return this.processResult(result);
					});
				} else {
					this.processResult(
						this.processResponse(
							xmlHTTP.readyState,
							callBack,
							xmlHTTP.responseText,
							_url
						)
					);
				}
			}
		}
	};

	this._url = function (fun, filename) {
		var args = Array();
		for (var i = 2; i < arguments.length; i++) {
			args[i - 2] = arguments[i];
		}
		var postData = this.param(args);

		var _args = '';
		for (var i = 2; i < arguments.length; i++) {
			_args += '&p' + (i - 2) + '=' + arguments[i];
		}

		if (fun.indexOf('.') < 0) {
			fun = this.systemName + '.' + fun;
		}

		return (
			this.srURL +
			'&name=' +
			fun +
			'&rand=' +
			Math.random() +
			//+ _args
			'&POSTCODE=' +
			this.toHex(postData) +
			(filename ? '&filename=' + filename : '')
		);
	};

	this._json = function (fun) {
		var args = Array();
		for (var i = 1; i < arguments.length; i++) {
			args[i - 1] = arguments[i];
		}
		if (fun.indexOf('.') < 0) {
			fun = this.systemName + '.' + fun;
		}
		return (
			this.srURL +
			'&name=' +
			fun +
			'&rand=' +
			Math.random() +
			'&json=clean&POSTCODE=' +
			this.toHex(this.param(args))
		);
	};

	this.myReplace = function (s, fc, rc) {
		if (typeof s !== 'string') return s;

		var ret = '';
		for (var i = 0; i < s.length; i++) {
			var rs = s.charAt(i);
			for (var j = 0; j < fc.length; j++) {
				if (s.charAt(i) == fc[j]) {
					rs = s.charAt(i).replace(fc[j], rc[j]);
				}
			}
			ret += rs;
		}
		return ret;
	};

	this.runCode = function (csCode, jsCode, pXML, callBack) {
		// avoid using this please
		var postData = 'StoredMethod m = new StoredMethod();' + this.CRNL;
		postData +=
			'm.BodyCode = "' +
			this.myReplace(csCode, ['"', '\r', '\n'], ['\\"', '\\r', '\\n']) +
			'";' +
			this.CRNL;
		postData +=
			'm.ReturnCode = "' +
			this.myReplace(jsCode, ['"', '\r', '\n'], ['\\"', '\\r', '\\n']) +
			'";' +
			this.CRNL;
		postData += 'm.Active = true;' + this.CRNL;
		postData += 'm.ObjectReturn = false;' + this.CRNL;
		postData += 'm.Signature = "string name";' + this.CRNL;
		postData += 'return new object[]{m, @"' + pXML + '"};' + this.CRNL;

		this.sendXML(this.srURL + '&code=true', postData, callBack);
	};

	this.Get = function (url, callBack) {
		if (!callBack) {
			// synchronous mode
			if (!window.jQuery) {
				// no jquery
			} else {
				return this.promise(
					null,
					$.ajax({
						type: 'GET',
						url: url,
						async: false,
						processData: false,
					})
				);
			}
		} else {
			// synchronous mode
			if (!window.jQuery) {
				// no jquery
			} else {
				$.ajax({
					type: 'GET',
					url: url,
					processData: false,
					success: (data) => callBack(data),
					error: (err) => callBack(null),
				});
			}
		}
	};

	this.Post = function (
		url,
		callBack,
		postData,
		headers,
		username,
		password,
		contentType
	) {
		var xmlHTTP = this.getXmlHTTP();

		if (xmlHTTP) {
			xmlHTTP.open('POST', url, true);
			xmlHTTP.withCredentials = 'true';
			if (crossDomain)
				xmlHTTP.setRequestHeader(
					'Access-Control-Allow-Origin',
					location.origin
				);
			if (contentType)
				xmlHTTP.setRequestHeader('Content-Type', contentType);
			if (username)
				xmlHTTP.setRequestHeader(
					'Authorization',
					'Basic ' + btoa('username:password')
				);

			if (headers)
				for (var i = 0; i < headers.length; i++)
					xmlHTTP.setRequestHeader(headers[i].key, headers[i].value);

			xmlHTTP.onreadystatechange = function () {
				if (window.xmlHTTP.readyState == 4 && callBack) {
					callBack(window.xmlHTTP.responseText);
				}
			};
			xmlHTTP.send(postData);
		}
	};

	this.hashCode = function (s) {
		var hash = 0,
			i,
			chr,
			len;
		if (s.length == 0) return hash;
		for (i = 0, len = s.length; i < len; i++) {
			chr = s.charCodeAt(i);
			hash = (hash << 5) - hash + chr;
			hash |= 0; // Convert to 32bit integer
		}
		return hash;
	};

	this.toHex = function (s) {
		if (typeof s !== 'string') return s;

		var arr1 = [];
		for (var n = 0, l = s.length; n < l; n++) {
			var hex = Number(s.charCodeAt(n)).toString(16);
			arr1.push(hex);
		}
		return arr1.join('');

		if (false) {
			var ret = '';
			for (var i = 0; i < Math.min(s.length, nMaxURLLength); i++) {
				var c = s.charAt(i);
				var hex = this.ascii_value(c).toString(16).toString();
				ret += hex + '-';
			}
			return ret;
		}
	};

	this.ascii_value = function (c) {
		// restrict input to a single character
		c = c.charAt(0);

		// loop through all possible ASCII values
		var i;
		for (i = 0; i < 256; ++i) {
			// convert i into a 2-digit hex string
			var h = i.toString(16);
			if (h.length == 1) h = '0' + h;

			// insert a % character into the string
			h = '%' + h;

			// determine the character represented by the escape code
			h = unescape(h);

			// if the characters match, we've found the ASCII value
			if (h == c) break;
		}
		return i;
	};

	/**
	 * Date Functions
	 */
	this.daysDiff = function (d2, d1) {
		return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
	};

	this.addMSeconds = function (o, ms) {
		return new Date(o.getTime() + ms);
	};

	this.addSeconds = function (o, s) {
		return this.addMSeconds(o, s * 1000);
	};

	this.addMinutes = function (o, m) {
		return this.addSeconds(o, m * 60);
	};

	this.addHours = function (o, h) {
		return this.addMinutes(o, h * 60);
	};

	this.addDays = function (o, d) {
		return this.addHours(o, d * 24);
	};

	this.addYears = function (o, y) {
		return this.addMonths(o, y * 12);
	};

	this.addMonths = function (o, m) {
		return new Date(
			o.getFullYear(),
			o.getMonth() + m,
			o.getDate(),
			o.getHours(),
			o.getMinutes(),
			o.getSeconds()
		);
	};

	this.isDate = function (o) {
		return (
			o != null &&
			o.constructor != null &&
			o.constructor.toString().indexOf('function Date(') > -1
		);
	};

	this.toShortDate = function (o) {
		if (!this.isDate(o)) return ''; // avoid nulls
		return o.getMonth() + 1 + '/' + o.getDate() + '/' + o.getFullYear();
	};

	this.toShortTime = function (o) {
		if (!this.isDate(o)) return ''; // avoid nulls
		var hours = '' + o.getHours(); //o.getHours()%12;
		var minutes = '' + o.getMinutes();
		var seconds = '' + o.getSeconds();
		if (hours.length < 2) hours = '0' + hours;
		if (minutes.length < 2) minutes = '0' + minutes;
		if (seconds.length < 2) seconds = '0' + seconds;
		return hours + ':' + minutes + ':' + seconds; // + " " + (o.getHours()>=12?"PM":"AM");
	};

	this.toDateTime = function (o) {
		if (!this.isDate(o)) return ''; // avoid nulls
		return this.toShortDate(o) + ' ' + this.toShortTime(o);
	};
	/**
	 * END: Date Functions
	 */

	this.setProperty = function (cid, s, prop, def) {
		if (!cid) return;
		var o = $(cid);
		if (!o) return;

		if (!prop) {
			if (o.tagName == 'INPUT') {
				prop = 'value';
				if (o.type == 'text') prop = 'value';
				if (o.type == 'checkbox') prop = 'checked';
			} else {
				prop = 'innerHTML';
			}
		}
		if (!def) def = '';
		if (this.preProcessHTML) def = this.preProcessHTML(def);

		if (this.isDate(s)) {
			// a date field
			s = this.toShortDate(s);
		} else {
			if (this.preProcessHTML) s = this.preProcessHTML(s);
		}

		window.propertyValue = s;
		try {
			this.runScript(
				"$('" + o.id + "')." + prop + ' = window.propertyValue;'
			);
		} catch (e) {
			this.ShowError(e.message);
			this.runScript("$('" + o.id + "')." + prop + ' = "' + def + '";');
		}
		window.propertyValue = null;
	};

	/**
	 * Validation
	 */
	this.validNotNull = function (s) {
		if (typeof s == 'string') {
			return s && s.length > 0;
		} else {
			return s != null;
		}
	};

	this.validObject = function (o) {
		return o != null;
	};

	this.validEmail = function (str) {
		var at = '@';
		var dot = '.';
		var lat = str.indexOf(at);
		var lstr = str.length;
		var ldot = str.indexOf(dot);
		if (
			str.indexOf(at) == -1 ||
			str.indexOf(at) == -1 ||
			str.indexOf(at) == 0 ||
			str.indexOf(at) == lstr ||
			str.indexOf(dot) == -1 ||
			str.indexOf(dot) == 0 ||
			str.indexOf(dot) == lstr ||
			str.indexOf(at, lat + 1) != -1 ||
			str.substring(lat - 1, lat) == dot ||
			str.substring(lat + 1, lat + 2) == dot ||
			str.indexOf(dot, lat + 2) == -1 ||
			str.indexOf(' ') != -1
		) {
			return false;
		} else {
			return true;
		}
	};

	this.validate = function (o, type, config) {
		if (typeof o == 'string') o = $(o);
		var bAlert = true;
		if (!o) return;

		if (!config) config = {};
		var oErr = $(o.id + '_Error');
		if (!oErr && document.insertAdjacentElement) {
			bAlert = false;
			oErr = document.createElement('SPAN');
			oErr.id = o.id + '_Error';
			oErr.className = 'error';
			o.insertAdjacentElement('afterEnd', oErr);
		}

		if (!config['field']) {
			var tag = o.tagName.toLowerCase();
			if (
				(tag == 'span' || tag == 'a') &&
				(o.getAttribute('from') || o.getAttribute('lookup'))
			) {
				config['field'] = 'SelectedItem';
				type = 'Object';
			} else {
				config['field'] = 'value';
			}
		}
		if (!type) type = 'NotNull';

		if (!config['label']) {
			var title = o.getAttribute('title');
			if (!title) {
				title = o.id.split('_');
				title = title[1];
				title = title.substr(3);
				title = this.EnglishName(title);
			}
			config['label'] = title;
		}
		if (!config['message']) config['message'] = 'Invalid Value';

		var bValid = true;
		window.validationValue = window.cms.v(o); //[config["field"]];//value
		bValid =
			bValid &&
			this.runScript(
				'window.cms.sr.valid' + type + '(window.validationValue)'
			);
		window.validationValue = null;

		if (!bValid) {
			//o.value = "";
			//o.focus();
			sMessage = config['message'];
		} else {
			sMessage = '';
		}

		if (!bValid) {
			if (bAlert) {
				this.s_ErrorMessages +=
					'\n' + config['label'] + ': ' + sMessage;
			} else {
				oErr.innerHTML = sMessage;
			}
		}
	};
	/**
	 * END: Validation
	 */

	this.EnglishName = function (s) {
		var ret = '';
		for (var i = 0; i < s.length; i++) {
			if (s[i] >= 'A' && s[i] <= 'Z') {
				ret += (ret.length == 0 ? '' : ' ') + s[i];
			} else if (ret.length == 0) {
				ret += (s[i] + '').toUpperCase();
			} else {
				ret += s[i];
			}
		}

		return ret;
	};

	/** Object Comparison **/
	this.newObject = function () {
		var ret = new Object();
		ret.__OBJECTID = Math.random();
		return ret;
	};

	this.Equals = function (o1, o2) {
		if (o1 == o2) return true;

		if (
			o1 &&
			o1.__OBJECTID &&
			o2 &&
			o2.__OBJECTID &&
			o1.__OBJECTID == o2.__OBJECTID
		)
			return true;
		if (o1 && o1.__ROWID && o2 && o2.__ROWID && o1.__ROWID == o2.__ROWID)
			return true;
		if (o1 && o1.Id && o2 && o2.Id && o1.Id == o2.Id) return true;

		return false;
	};
	/** Object Comparison **/

	this.serialize = function (_obj) {
		try {
			// Let Gecko browsers do this the easy way
			if (
				typeof _obj.toSource !== 'undefined' &&
				typeof _obj.callee === 'undefined'
			) {
				return _obj.toSource();
			}
			// Other browsers must do it the hard way
			switch (typeof _obj) {
				// numbers, booleans, and functions are trivial:
				// just return the object itself since its default .toString()
				// gives us exactly what we want
			case 'number':
			case 'boolean':
			case 'function':
				return _obj;
				break;

				// for JSON format, strings need to be wrapped in quotes
			case 'string':
				return "'" + _obj + "'";
				break;

			case 'object':
				var str;
				if (
					_obj.constructor === Array ||
					typeof _obj.callee !== 'undefined'
				) {
					str = '[';
					var i,
						len = _obj.length;
					for (i = 0; i < len - 1; i++) {
						str += this.serialize(_obj[i]) + ',';
					}
					str += this.serialize(_obj[i]) + ']';
				} else {
					str = '{';
					var key;
					for (key in _obj) {
						str += key + ':' + this.serialize(_obj[key]) + ',';
					}
					str = str.replace(/\,$/, '') + '}';
				}
				return str;
				break;

			default:
				return 'UNKNOWN';
				break;
			}
		} catch (e) {
			this.ShowDebug(e.message);
		}
	};
}