var tableDataTemplate = '<tr>' +
	'<td>{gmailId}</td>' +
	'<td>{orgName}</td>' +
	'<td>{email}</td>' +
	'<td>{begin}</td>' +
	'<td>{end}</td>' +
	'<td>{sourceIp}</td>' +
	'<td>{count}</td>' +
	'<td>{dkim}</td>' +
	'<td>{spf}</td>' +
	'<td>{action}</td>' +
	'</tr>';

var tableEnd = '</table>';

var tableStart = '<table>' +
	'<tr>' +
	'<th>Gmail ID</th>' +
	'<th>Org Name</th>' +
	'<th>Email</th>' +
	'<th>Start</th>' +
	'<th>End</th>' +
	'<th>Source IP</th>' +
	'<th>Count</th>' +
	'<th>DKIM Passed</th>' +
	'<th>SPF Passed</th>' +
	'<th>Action Taken</th>' +
	'</tr>';


function doAjax(url, onSuccess, onFailure) {
	var xmlhttprequest = new XMLHttpRequest();

	xmlhttprequest.onreadystatechange = function() {
		if (xmlhttprequest.readyState == XMLHttpRequest.DONE) {
			if (xmlhttprequest.status == 200) {
				onSuccess(xmlhttprequest.responseText);
			}
			else {
				onFailure(xmlhttprequest.status)
			}
		}
	};

	xmlhttprequest.open('GET', url);
	xmlhttprequest.send();
}

function renderCharts(aggregateReports) {
	var action = {};
	var aggregate = {};
	var dkim = {};
	var spf = {};

	for (var i = 0, len = aggregateReports.length; i < len; i++) {
		var aggregateReport = aggregateReports[i];

		var records = aggregateReport.record;

		if (!records) {
			continue;
		}

		for (var j = 0, len2 = records.length; j < len2; j++) {
			var record = records[j];

			var dkimResult = record.row.policyEvaluated.dkim;
			dkim[dkimResult] = (dkim[dkimResult]) ? dkim[dkimResult] + record.row.count : record.row.count;

			var spfResult = record.row.policyEvaluated.spf;
			spf[spfResult] = (spf[spfResult]) ? spf[spfResult] + record.row.count : record.row.count;

			var aggregateResult = (dkimResult == 'pass' || spfResult == 'pass')
				? 'pass'
				: 'fail';
			aggregate[aggregateResult] = (aggregate[aggregateResult]) ? aggregate[aggregateResult] + record.row.count : record.row.count;

			var actionResult = (aggregateResult == 'pass')
				? 'none'
				: record.row.policyEvaluated.disposition;
			action[actionResult] = (action[actionResult]) ? action[actionResult] + record.row.count : record.row.count;
		}
	}

	var colorScheme =  {
		'pass': 'limegreen',
		'fail': 'crimson',
		'none': 'green',
		'quarantine': 'yellow',
		'reject': 'red'
	};

	c3.generate({
		bindto: '#dkimGraph',
		data: {
			colors: colorScheme,
			json: dkim,
			type: 'pie'
		}
	});

	c3.generate({
		bindto: '#spfGraph',
		data: {
			colors: colorScheme,
			json: spf,
			type: 'pie'
		}
	});

	c3.generate({
		bindto: '#aggregateGraph',
		data: {
			colors: colorScheme,
			json: aggregate,
			type: 'pie'
		}
	});

	c3.generate({
		bindto: '#actionGraph',
		data: {
			colors: colorScheme,
			json: action,
			type: 'pie'
		}
	});
}

function renderTable(aggregateReports, boundingBoxId) {
	var container = document.getElementById(boundingBoxId);

	var tableHTML = tableStart;

	for (var i = 0, len = aggregateReports.length; i < len; i++) {
		var aggregateReport = aggregateReports[i];

		var records = aggregateReport.record;

		if (!records) {
			continue;
		}

		for (var j = 0, len2 = records.length; j < len2; j++) {
			var record = records[j];

			tableHTML += tableDataTemplate
				.replace('{gmailId}', aggregateReport.gmailId)
				.replace('{orgName}', aggregateReport.reportMetadata.orgName)
				.replace('{email}', aggregateReport.reportMetadata.email)
				.replace('{begin}', aggregateReport.reportMetadata.dateRange.begin)
				.replace('{end}', aggregateReport.reportMetadata.dateRange.end)
				.replace('{sourceIp}', record.row.sourceIp)
				.replace('{count}', record.row.count)
				.replace('{dkim}', record.row.policyEvaluated.dkim)
				.replace('{spf}', record.row.policyEvaluated.spf)
				.replace('{action}', function() {
					var failed = (record.row.policyEvaluated.dkim == 'fail') &&
						(record.row.policyEvaluated.spf == 'fail');

					return failed ? record.row.policyEvaluated.disposition : 'none';
				});
		}
	}

	tableHTML += tableEnd;

	container.innerHTML = tableHTML;
}

function toggleVerbose() {
	var hidden = document.getElementById('table').classList.toggle('hide');

	document.getElementById('verbose').innerHTML = hidden ? ' Show Data ' : ' Hide Data ';
}

function updateData(query) {
	var url = '/aggregatereports';

	if (query) {
		url += '?orgName=' + query;
	}

	doAjax(
		url,
		function(json) {
			var obj = eval(json);

			renderCharts(obj);
			renderTable(obj, 'table');
		},
		function(status) {
			alert('Request responded with status ' + status)
		}
	);
}

document.addEventListener('DOMContentLoaded', function(event) {
	updateData();
});