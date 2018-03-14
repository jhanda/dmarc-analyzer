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
	'<td><a href="/email/{gmailId}">Email</a></td>' +
	'</tr>';

var tableEnd = '</table>';

var tableStart = '<table>' +
	'<tr>' +
	'<th title="gmailId">Gmail ID</th>' +
	'<th title="orgName">Org Name</th>' +
	'<th title="email">Email</th>' +
	'<th title="begin">Start</th>' +
	'<th title="end">End</th>' +
	'<th title="sourceIp">Source IP</th>' +
	'<th title="count">Count</th>' +
	'<th title="dkim">DKIM Passed</th>' +
	'<th title="spf">SPF Passed</th>' +
	'<th title="action">Action Taken</th>' +
	'<th>Links</th>' +
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
	var action = {}, dmarc = {}, dkim = {}, sourceIp = {}, spf = {};

	for (var i = 0, len = aggregateReports.length; i < len; i++) {
		var aggregateReport = aggregateReports[i];

		var records = aggregateReport.record;

		if (!records) {
			continue;
		}

		for (var j = 0, len2 = records.length; j < len2; j++) {
			var record = records[j];

			var dkimResult = record.row.policyEvaluated.dkim;
			dkim[dkimResult] = dkim[dkimResult] ? dkim[dkimResult] + record.row.count : record.row.count;

			var sourceIpResult = record.row.sourceIp;
			sourceIp[sourceIpResult] = sourceIp[sourceIpResult] ? sourceIp[sourceIpResult] + record.row.count : record.row.count;

			var spfResult = record.row.policyEvaluated.spf;
			spf[spfResult] = spf[spfResult] ? spf[spfResult] + record.row.count : record.row.count;

			var dmarcResult = (dkimResult == 'pass' || spfResult == 'pass')
				? 'pass'
				: 'fail';
			dmarc[dmarcResult] = dmarc[dmarcResult] ? dmarc[dmarcResult] + record.row.count : record.row.count;

			var actionResult = (dmarcResult == 'pass')
				? 'none'
				: record.row.policyEvaluated.disposition;
			action[actionResult] = action[actionResult] ? action[actionResult] + record.row.count : record.row.count;
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
		bindto: '#dmarcGraph',
		data: {
			colors: colorScheme,
			json: dmarc,
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

	c3.generate({
		bindto: '#sourceIpGraph',
		data: {
			json: sourceIp,
			type: 'pie'
		},
		legend: {
			show: (Object.keys(sourceIp).length > 4) ? false : true
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
				.replace(/{gmailId}/g, aggregateReport.gmailId)
				.replace(/{orgName}/g, aggregateReport.reportMetadata.orgName)
				.replace(/{email}/g, aggregateReport.reportMetadata.email)
				.replace(/{begin}/g, aggregateReport.reportMetadata.dateRange.begin)
				.replace(/{end}/g, aggregateReport.reportMetadata.dateRange.end)
				.replace(/{sourceIp}/g, record.row.sourceIp)
				.replace(/{count}/g, record.row.count)
				.replace(/{dkim}/g, record.row.policyEvaluated.dkim)
				.replace(/{spf}/g, record.row.policyEvaluated.spf)
				.replace(/{action}/g, function() {
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
		url += '?' + query;
	}

	doAjax(
		url,
		function(json) {
			var obj = JSON.parse(json);

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